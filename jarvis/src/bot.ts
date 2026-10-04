// Handles incoming Telegram updates: pairing, commands, buttons, and conversation.
import { PASSIVE_MEMORY_RULES, applyMemory, passiveMemorySchema, passiveOnly, type MemoryOps } from './memory';
import { historyToAgent, runAgent, type TraceEntry } from './agent/loop';
import { TOOLS } from './agent/tools';
import { verifyReply } from './agent/verify';
import { memorySnapshot, persona, planLine, timeContext } from './context';
import { generateJson, parseJsonLoose } from './services';
import { ownerChat, say } from './say';
import { Store } from './store';
import { addDays, atLocal, human, localDate, utc } from './time';
import { LlmError, type Deps } from './types';
import { runBriefing, runCheckin } from './scheduler';
import { syncEmail } from './email/sync';
import { VOICES } from './edge';

const HELP = `Hey! I'm Jarvis. Just talk to me, by voice note or text. I remember what you tell me, remind you about things, and check in on you.

Things you can say: "remind me to call mom at 8", "Friday I have a dentist appointment", "what do you know about me?", "forget that".

Commands:
/memory - what I remember
/plans - upcoming plans and reminders
/briefing - morning briefing now
/checkin - evening check-in now
/pause 3 - no proactive messages for 3 hours (/resume to undo)
/emails - check your inbox now
/voices - hear the voices and pick one
/status - check everything is working
/export - download all my memory as a file
/forget 12 - delete fact number 12
/ping - check I'm alive`;

export async function handleUpdate(deps: Deps, update: any): Promise<void> {
	const store = new Store(deps.db);
	if (typeof update?.update_id === 'number' && !(await store.claim('updates', update.update_id, utc(deps.now())))) return; // retry of one we handled

	if (update.callback_query) return handleButton(deps, store, update.callback_query);
	const msg = update.message;
	if (!msg?.chat?.id) return;
	const chatId = String(msg.chat.id);
	const text: string = (msg.text ?? msg.caption ?? '').trim();

	const owner = await ownerChat(deps, store);
	if (!owner) {
		const code = /^\/start\s+(\S+)/.exec(text)?.[1];
		if (deps.config.pairCode && code === deps.config.pairCode) {
			await store.set('owner_chat_id', chatId);
			await deps.tg.sendMessage(chatId, `Paired! Hey ${deps.config.name}, I'm Jarvis, your new buddy. 👋\n\n${HELP}`);
			await store.addMessage('jarvis', `Paired with ${deps.config.name}.`, 'system', utc(deps.now()));
		} else {
			await deps.tg.sendMessage(chatId, 'Hi! This is a private assistant. If you are the owner, send: /start <your pair code>');
		}
		return;
	}
	if (chatId !== owner) return; // private bot: ignore everyone else

	if (text.startsWith('/')) return handleCommand(deps, store, chatId, text);

	const voice = msg.voice ?? msg.audio;
	if (voice?.file_id) {
		await deps.tg.sendChatAction(chatId, 'typing');
		let heard = '';
		const tl = Date.now();
		try {
			const audio = await deps.tg.getFile(voice.file_id);
			heard = await deps.speech.transcribe(audio, voice.mime_type ?? 'audio/ogg');
		} catch (e) {
			console.warn('transcription failed', e);
		}
		if (!heard) {
			await deps.tg.sendMessage(chatId, "Sorry, I couldn't catch that voice note. Could you try again or type it?");
			return;
		}
		return converse(deps, store, chatId, heard, true, { listen: Date.now() - tl });
	}
	const imageFileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id : /^image\//.test(msg.document?.mime_type ?? '') ? msg.document.file_id : null;
	if (imageFileId) return handlePhoto(deps, store, chatId, msg, imageFileId, text);
	if (msg.document || msg.sticker || msg.video || msg.video_note) {
		if (!text) {
			await deps.tg.sendMessage(chatId, "I can't open videos or files yet, but photos work! Tell me what it is?");
			return;
		}
	}
	if (!text) return;
	// A question right after photos ("which one should I post?") gets to see them.
	const photos = await takeRecentPhotos(store, deps.now(), null);
	return converse(deps, store, chatId, text, false, {}, await downloadPhotos(deps, photos));
}

interface PendingPhoto {
	fileId: string;
	mime: string;
	at: number;
	group: string | null;
	msgId: number;
}

const PHOTO_WINDOW_MS = 3 * 60_000;

/** Photos not yet replied to, one kv row each (photo:<message id>) so concurrent album updates never clash. */
async function loadPhotos(store: Store, now: Date): Promise<PendingPhoto[]> {
	const rows = await store.withPrefix('photo:');
	const out: PendingPhoto[] = [];
	for (const r of rows) {
		try {
			const p = JSON.parse(r.v) as PendingPhoto;
			if (now.getTime() - p.at < PHOTO_WINDOW_MS) out.push(p);
			else await store.del(r.k);
		} catch {
			await store.del(r.k);
		}
	}
	return out;
}

/** Claims photos (one album, or all recent ones). Only photos this call managed to claim are returned. */
async function takeRecentPhotos(store: Store, now: Date, group: string | null): Promise<PendingPhoto[]> {
	const list = (await loadPhotos(store, now)).filter((p) => !group || p.group === group);
	const taken: PendingPhoto[] = [];
	for (const p of list) if (await store.take(`photo:${p.msgId}`)) taken.push(p);
	return taken.sort((a, b) => a.msgId - b.msgId).slice(-4);
}

async function downloadPhotos(deps: Deps, photos: PendingPhoto[]): Promise<{ mime: string; data: Uint8Array }[]> {
	const out: { mime: string; data: Uint8Array }[] = [];
	for (const p of photos) {
		try {
			out.push({ mime: p.mime, data: await deps.tg.getFile(p.fileId) });
		} catch (e) {
			console.warn('photo download failed', e);
		}
	}
	return out;
}

/**
 * Albums arrive as one update per photo, often followed by a text question. Wait a moment, then reply once:
 * the last photo of an album answers for all of them, and a following text message takes over entirely.
 */
async function handlePhoto(deps: Deps, store: Store, chatId: string, msg: any, fileId: string, caption: string): Promise<void> {
	const now = deps.now();
	const group: string | null = msg.media_group_id ?? null;
	const me: PendingPhoto = { fileId, mime: msg.document?.mime_type ?? 'image/jpeg', at: now.getTime(), group, msgId: msg.message_id ?? 0 };
	await store.set(`photo:${me.msgId}`, JSON.stringify(me));
	await deps.tg.sendChatAction(chatId, 'typing');
	if (group || !caption) await (deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms))))(2500);
	const current = await loadPhotos(store, now);
	const mine = current.find((p) => p.fileId === fileId);
	if (!mine) return; // a text message already answered with this photo
	if (group && current.some((p) => p.group === group && p.msgId > mine.msgId)) return; // a later album photo will answer
	const photos = await takeRecentPhotos(store, now, group);
	if (!photos.length) return; // claimed by a text message in the meantime
	const images = await downloadPhotos(deps, photos);
	if (!images.length) {
		await deps.tg.sendMessage(chatId, "Couldn't load that photo, man. Mind sending it again?");
		return;
	}
	const label = images.length > 1 ? `[sent ${images.length} photos]` : '[sent a photo]';
	return converse(deps, store, chatId, caption ? `${label} ${caption}` : label, false, {}, images);
}

/**
 * Replying is latency-critical; remembering is not. So the reply comes from one quick call (minimal
 * thinking, plain text), goes out, and only then a second call extracts memory updates.
 */
export async function converse(
	deps: Deps,
	store: Store,
	chatId: string,
	text: string,
	viaVoice: boolean,
	timings: Record<string, number> = {},
	images: { mime: string; data: Uint8Array }[] = [],
): Promise<void> {
	try {
		await converseInner(deps, store, chatId, text, viaVoice, timings, images);
	} catch (e) {
		// Never leave him on read: anything unexpected still gets an answer.
		console.error('conversation failed', e);
		await store.diag('brain', false, `unexpected: ${String(e)}`, utc(deps.now()));
		await deps.tg.sendMessage(chatId, 'Oops, something glitched on my side 😅 Say that again?').catch(() => undefined);
	}
}

async function converseInner(
	deps: Deps,
	store: Store,
	chatId: string,
	text: string,
	viaVoice: boolean,
	timings: Record<string, number>,
	images: { mime: string; data: Uint8Array }[],
): Promise<void> {
	const now = deps.now();
	const t0 = Date.now();
	await Promise.all([store.addMessage('user', text, 'chat', utc(now)), deps.tg.sendChatAction(chatId, viaVoice ? 'record_voice' : 'typing')]);
	let reply: string;
	let trace: TraceEntry[] = [];
	let by: string | undefined;
	let flags: string[] = [];
	const tl = Date.now();
	try {
		({ text: reply, trace, by, flags = [] } = await replyTo(deps, store, now, images, chatId));
	} catch (e) {
		console.error('chat failed', e);
		const kind = e instanceof LlmError ? e.kind : 'unavailable';
		await store.diag('brain', false, String(e), utc(now));
		await store.set('pending_reply', utc(now));
		const sorry =
			kind === 'quota'
				? "My brain hit its free limit for the moment 😅 I've saved what you said and I'll get back to you as soon as I can."
				: kind === 'config'
					? "I can't reach my brain. The Gemini API key looks wrong or missing, so please check the GEMINI_API_KEY secret."
					: "My brain is having a hiccup right now. I've saved your message and will reply shortly.";
		await deps.tg.sendMessage(chatId, sorry);
		return;
	}
	timings.brain = Date.now() - tl;
	const ts = Date.now();
	const meta = [
		...Object.entries({ ...timings, voice: viaVoice ? 1 : 0 }).map(([k, v]) => `${k}=${v}`),
		...(by ? [`by=${by}`] : []),
		...(trace.length ? [`tools=${trace.map((t) => `${t.tool}${t.ok ? '' : '!'}`).join(',')}`] : []),
		...(flags.length ? [`agent=${flags.join(',')}`] : []),
	].join(' ');
	await say(deps, chatId, reply, { voice: viaVoice, kind: 'chat', meta });
	timings.send = Date.now() - ts;
	timings.total = Date.now() - t0 + (timings.listen ?? 0);
	await store.del('pending_reply');
	await store.diag('brain', true, 'replying normally', utc(now));
	await store.diag('latency', true, Object.entries(timings).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`).join(', '), utc(now));
	// Background memory runs from the next cron tick: this invocation has spent much of its 50-query allowance.
}

export const AGENT_RULES = `HOW YOU THINK AND ACT
You're not a chatbot that just answers; you're a sharp friend who works out what he actually needs and gets it done.
1. Read his message in the context of the conversation. What does he really want right now: info, a decision, something done, or just a friend?
2. Get the facts before you talk. Use tools: recall for his past (anything not in WHAT YOU KNOW), web_search for anything about the
   world, get_weather, check_email. Call several at once when useful. Skip tools for plain chit-chat.
3. When he asks you to do something (remind him, save or change a plan, track a habit, remember or forget something), do it with the
   tool, then confirm what the tool result says, with the exact day and time. If a tool errors, fix the arguments and try once more, or tell him honestly.
4. When he's deciding something, make the call: pick one option and give the reason in a line, using what you know about him
   (his plans, preferences, the weather, the time). Never hand back a list of options.
5. Think one step ahead: a clash with his plans, rain on the way, a deadline, travel time. Mention the one thing that matters, only if it does.

GROUNDING (the most important rule)
- Personal details (places he likes, people, past events, habits) come ONLY from WHAT YOU KNOW or recall results. Never say
  "that X place you love" unless memory says so. If recall finds nothing, say you don't remember, or ask.
- Real-world specifics (restaurant or shop names, prices, scores, news, timings) come ONLY from web_search results or things you are
  certain of. Never invent a place name. For suggestions, search first, then recommend one real place.
- Only say you did something if a tool result says it worked.
- Don't drag in random memories. Bring up something you remember only when it's relevant to what he's talking about right now.`;

const STYLE_TAIL = `Reply with just your message to him: plain spoken words in your buddy voice, usually 1-3 short sentences (more only if he asks).
If he tells you how a plan went, react like a friend. If he asks what you know about him, sum it up warmly.
Never claim you did something you cannot do (send an email, book something).
When you can't do something yourself (book tickets, pay, call someone), never stop at "I can't": offer the next best thing,
like searching the options and prices, the quickest way to do it, or offering a reminder at a sensible time.
Don't repeat the same nudge (an unbooked ticket, a pending task) more than once in a conversation unless he brings it up.
His messages are often voice transcriptions, so words and Indian place names can be misheard: work out the likely meaning
(e.g. "Hodi" is probably Hoodi in Bengaluru) instead of saying you don't know a place.
He travels; for weather or places use where he says he is now, not just his home city. You can't see live traffic or his GPS:
for routes, give the typical travel time and say Maps will show live traffic.
If he sends a photo, actually look at it and react to what's in it like a friend would.
Never say "I don't know" about the world before searching. Answer in your own words in your buddy voice; never read out links, sources or citations.`;

function emailNote(deps: Deps): string {
	return deps.mail
		? `EMAIL: you DO have read-only access to his Gmail. Recent important ones are under RECENT IMPORTANT EMAILS; for anything about mail, use check_email to look right now. If nothing turns up, tell him casually the inbox is quiet. Never say you lack email access, and never mention a calendar (you only see what he tells you and what email says).`
		: `EMAIL: his Gmail is not connected yet. If he asks, tell him to add GMAIL_ADDRESS and GMAIL_APP_PASSWORD (see SETUP.md).`;
}

/** The agent: thinks, uses tools (memory, reminders, plans, web, weather, email), then answers in Jarvis's voice. */
export async function replyTo(
	deps: Deps,
	store: Store,
	now: Date,
	images: { mime: string; data: Uint8Array }[] = [],
	chatId?: string,
): Promise<{ text: string; trace: TraceEntry[]; by?: string; flags?: string[] }> {
	const [snapshot, recent] = await Promise.all([memorySnapshot(store, now), store.recentMessages(20)]);
	const system = `${persona(deps.config.name, deps.config.city)}\n\n${timeContext(now)}\n\nWHAT YOU KNOW:\n${snapshot}\n\n${emailNote(deps)}\n\n${AGENT_RULES}\n\n${STYLE_TAIL}`;
	const out = await runAgent(deps.llm, {
		system,
		messages: historyToAgent(toTurns(recent)),
		tools: TOOLS,
		ctx: { deps, store, now },
		temperature: 0.8,
		images,
		maxSteps: 6,
		budgetMs: 25_000,
		verify: verifyReply,
		onTools: chatId ? () => deps.tg.sendChatAction(chatId, 'typing') : undefined,
	});
	const reply = cleanReply(out.text);
	if (!reply) throw new LlmError('empty reply', 'bad_response');
	const flags = [...(out.recovered ? ['recovered'] : []), ...(out.revised?.length ? ['revised'] : [])];
	return { text: reply, trace: out.trace, by: out.by, flags };
}

/** Models sometimes wrap a plain reply in quotes, a "Jarvis:" label or a JSON object; unwrap it. */
export function cleanReply(text: string): string {
	let t = text
		.trim()
		.replace(/^```\w*\s*/, '')
		.replace(/\s*```$/, '')
		.trim();
	if (t.startsWith('{')) {
		const parsed = parseJsonLoose(t) as { reply?: unknown } | undefined;
		if (parsed && typeof parsed.reply === 'string') t = parsed.reply;
	}
	return t
		.replace(/^(jarvis|you)\s*:\s*/i, '')
		.replace(/^"([\s\S]*)"$/, '$1')
		.trim();
}

/** Small talk with nothing to remember; saved for the next batch instead of spending a call now. */
export function isSmallTalk(text: string): boolean {
	const t = text.trim().toLowerCase();
	return t.length < 25 && /^(ok(ay)?|k|haha+|lol|lmao|yeah?|yes|yep|no|nope|nice|cool|great|thanks|thank you|thx|hmm+|hi|hey|hello|yo|good night|gn|good morning|gm|😂|👍|❤️|🙏)[\s!.?😂👍❤️🙏]*$/u.test(t);
}

/**
 * Turns the messages since the last successful run into memory updates. Runs right after a reply (unless it was
 * small talk) and from the scheduler; if it fails (e.g. quota), the pointer stays put and the next run retries,
 * so nothing he said is ever silently dropped.
 */
export async function processMemory(deps: Deps, store: Store, now: Date): Promise<'done' | 'nothing' | 'failed'> {
	let last = Number(await store.get('mem_processed_id'));
	if (!Number.isFinite(last) || (await store.get('mem_processed_id')) === null) {
		// First run after this feature shipped: older history was already handled the old way.
		const recent = await store.recentMessages(2);
		last = recent.length ? recent[0].id - 1 : 0;
	}
	const pending = await store.messagesAfter(last, 30);
	if (!pending.some((m) => m.role === 'user')) {
		if (pending.length) await store.set('mem_processed_id', String(pending[pending.length - 1].id));
		return 'nothing';
	}
	try {
		const snapshot = await memorySnapshot(store, now);
		const transcript = pending.map((m) => `${m.role === 'user' ? deps.config.name : 'Jarvis'} (${human(new Date(m.at))}): ${m.text}`).join('\n');
		const ops = await generateJson<MemoryOps>(deps.llm, {
			system: `You maintain the long-term memory of ${deps.config.name}'s AI buddy, Jarvis.\n\n${timeContext(now)}\n\nWHAT IS ALREADY KNOWN:\n${snapshot}\n\n${PASSIVE_MEMORY_RULES}`,
			turns: [{ role: 'user', text: `New messages to process (resolve relative dates against when each was said):\n${transcript}\n\nReturn the memory updates as JSON.` }],
			schema: passiveMemorySchema,
			temperature: 0.2,
			tier: 'light',
		});
		await applyMemory(store, passiveOnly(ops), now);
		await store.set('mem_processed_id', String(pending[pending.length - 1].id));
		await store.diag('memory', true, `saved from ${pending.length} messages`, utc(now));
		return 'done';
	} catch (e) {
		console.error('memory update failed', e);
		await store.diag('memory', false, `will retry: ${String(e).slice(0, 200)}`, utc(now));
		return 'failed';
	}
}

/** Gemini wants alternating user/model turns that end with the user. */
export function toTurns(messages: { role: string; text: string; kind?: string }[]): { role: 'user' | 'model'; text: string }[] {
	const turns: { role: 'user' | 'model'; text: string }[] = [];
	for (const m of messages) {
		const role = m.role === 'user' ? 'user' : 'model';
		const text = m.role === 'user' ? m.text : m.kind && m.kind !== 'chat' ? `[${m.kind}] ${m.text}` : m.text;
		const last = turns[turns.length - 1];
		if (last && last.role === role) last.text += `\n${text}`;
		else turns.push({ role, text });
	}
	while (turns.length && turns[0].role === 'model') turns.shift();
	if (!turns.length || turns[turns.length - 1].role !== 'user') turns.push({ role: 'user', text: '(continue)' });
	return turns;
}

async function handleCommand(deps: Deps, store: Store, chatId: string, text: string): Promise<void> {
	const [cmdRaw, ...args] = text.split(/\s+/);
	const cmd = cmdRaw.replace(/@.*/, '').toLowerCase();
	const now = deps.now();
	switch (cmd) {
		case '/start':
		case '/help':
			return deps.tg.sendMessage(chatId, HELP);
		case '/ping':
			return deps.tg.sendMessage(chatId, `Pong! I'm here. It's ${human(now)}.`);
		case '/memory': {
			const [facts, people, goals] = await Promise.all([store.facts(), store.people(), store.goals()]);
			const lines = [
				`🧠 What I remember about you (${facts.length} facts):`,
				...(facts.length ? facts.map((f) => `${f.id}. ${f.text}`) : ['Nothing yet. Tell me about yourself!']),
			];
			if (people.length) lines.push('', `👥 People: ${people.map((p) => (p.relation ? `${p.name} (${p.relation})` : p.name)).join(', ')}`);
			if (goals.length) lines.push('', `🎯 Goals: ${goals.map((g) => `${g.title} (streak ${g.streak})`).join(', ')}`);
			lines.push('', 'To delete a fact: /forget <number>');
			return deps.tg.sendMessage(chatId, lines.join('\n'));
		}
		case '/plans': {
			const plans = await store.plansBetween(utc(now), utc(atLocal(addDays(localDate(now), 60), 0)));
			const reminders = await store.upcomingReminders(utc(now));
			const lines = ['📅 Upcoming plans:', ...(plans.length ? plans.map((p) => planLine(p, now).replace(/^\d+: /, '• ')) : ['None'])];
			lines.push('', '⏰ Reminders:', ...(reminders.length ? reminders.map((r) => `• ${human(new Date(r.due_at))}: ${r.text}`) : ['None']));
			return deps.tg.sendMessage(chatId, lines.join('\n'));
		}
		case '/forget': {
			const id = Number(args[0]);
			if (!Number.isInteger(id)) return deps.tg.sendMessage(chatId, 'Tell me the fact number from /memory, like /forget 12. Or just say "forget that" in chat.');
			return deps.tg.sendMessage(chatId, (await store.deleteFact(id)) ? `Done, I forgot fact ${id}.` : `I don't have a fact ${id}.`);
		}
		case '/pause': {
			const hours = Math.min(Math.max(Number(args[0]) || 3, 0.5), 24 * 14);
			const until = new Date(now.getTime() + hours * 3600_000);
			await store.set('paused_until', utc(until));
			return deps.tg.sendMessage(chatId, `Okay, I'll stay quiet until ${human(until)}. Reminders you set will still come through. /resume to undo.`);
		}
		case '/resume':
			await store.del('paused_until');
			return deps.tg.sendMessage(chatId, "I'm back! 🙌");
		case '/export': {
			const data = await store.exportAll();
			const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
			return deps.tg.sendDocument(chatId, bytes, `jarvis-memory-${localDate(now)}.json`, 'Everything I remember, as a file.');
		}
		case '/emails': {
			if (!deps.mail) return deps.tg.sendMessage(chatId, "Gmail isn't connected yet. Add the GMAIL_ADDRESS and GMAIL_APP_PASSWORD secrets and redeploy.");
			await deps.tg.sendChatAction(chatId, 'typing');
			const err = await checkMailNow(deps, store, now);
			if (err) return deps.tg.sendMessage(chatId, `I couldn't check Gmail: ${err}`);
			const mails = await store.recentEmails(utc(new Date(now.getTime() - 2 * 86_400_000)));
			if (!mails.length) return deps.tg.sendMessage(chatId, '📭 Nothing important in your inbox from the last 2 days.');
			return deps.tg.sendMessage(chatId, `📬 Important email, last 2 days:\n${mails.map((m) => `• ${m.importance === 'high' ? '❗ ' : ''}${m.summary}`).join('\n')}`);
		}
		case '/status': {
			const diags = await store.diags();
			const lines = ['🩺 Jarvis status', `Time: ${human(now)}`, `Gmail: ${deps.mail ? 'connected' : 'not connected'}`];
			for (const d of diags) lines.push(`${d.ok ? '✅' : '⚠️'} ${d.name} (${human(new Date(d.at))}): ${d.info}`);
			if (!diags.length) lines.push('No activity recorded yet.');
			return deps.tg.sendMessage(chatId, lines.join('\n'));
		}
		case '/voices': {
			await deps.tg.sendMessage(chatId, "Here's how each voice sounds. Tap a button to pick one 👇");
			for (const [key, v] of Object.entries(VOICES)) {
				const audio = await deps.speech.synthesize(`Hey ${deps.config.name}! I'm ${v.label.split(':')[0]}. How's your day going? I'll keep you on top of things.`, key);
				if (audio) await deps.tg.sendVoice(chatId, audio.audio, audio.mime, v.label);
			}
			const keys = Object.keys(VOICES);
			const rowsOfButtons = [];
			for (let i = 0; i < keys.length; i += 3) rowsOfButtons.push(keys.slice(i, i + 3).map((k) => ({ text: `${k[0].toUpperCase()}${k.slice(1)}`, data: `v:${k}` })));
			return deps.tg.sendMessage(chatId, 'Which voice do you like?', rowsOfButtons);
		}
		case '/briefing':
			return runBriefing(deps, store, chatId, now);
		case '/checkin':
			return runCheckin(deps, store, chatId, now);
		default:
			return converse(deps, store, chatId, text, false);
	}
}

async function handleButton(deps: Deps, store: Store, cq: any): Promise<void> {
	const owner = await ownerChat(deps, store);
	const chatId = String(cq.message?.chat?.id ?? cq.from?.id ?? '');
	if (!owner || chatId !== owner) return deps.tg.answerCallback(cq.id);
	const [kind, action, idRaw] = String(cq.data ?? '').split(':');
	const id = Number(idRaw);
	const now = deps.now();
	if (kind === 'r' && Number.isInteger(id)) {
		const r = await store.reminder(id);
		if (!r) return deps.tg.answerCallback(cq.id, 'That reminder is gone.');
		if (action === 'done') {
			await store.completeReminder(id);
			return deps.tg.answerCallback(cq.id, 'Nice, marked done ✅');
		}
		const due = action === '1h' ? new Date(now.getTime() + 3600_000) : action === 'eve' ? atLocal(localDate(now), 19) : atLocal(addDays(localDate(now), 1), 9);
		const when = due > now ? due : new Date(now.getTime() + 3600_000);
		await store.snoozeReminder(id, utc(when));
		return deps.tg.answerCallback(cq.id, `Snoozed until ${human(when, false)}`);
	}
	if (kind === 'v' && VOICES[action]) {
		await store.set('tts_voice', action);
		await deps.tg.answerCallback(cq.id, `Voice set to ${action}`);
		const audio = await deps.speech.synthesize(`Done! This is my voice from now on, ${deps.config.name}.`);
		if (audio) await deps.tg.sendVoice(chatId, audio.audio, audio.mime);
		return;
	}
	if (kind === 'a' && Number.isInteger(id)) {
		await store.setAdminStatus(id, action === 'done' ? 'done' : 'open');
		return deps.tg.answerCallback(cq.id, 'Marked done ✅');
	}
	return deps.tg.answerCallback(cq.id);
}

/** Syncs Gmail right away (bounded wait). Returns an error message, or null on success. */
async function checkMailNow(deps: Deps, store: Store, now: Date, timeoutMs = 20_000): Promise<string | null> {
	try {
		const n = await Promise.race([
			syncEmail(deps, store, now),
			new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Gmail took too long to answer')), timeoutMs)),
		]);
		await store.diag('email', true, `checked on request, ${n} new`, utc(now));
		return null;
	} catch (e) {
		console.error('email check failed', e);
		const msg = String(e).replace(/^Error: /, '');
		await store.diag('email', false, msg, utc(now));
		return msg;
	}
}

/** Retries a reply that failed earlier (e.g. Gemini quota). Called from the scheduler. */
export async function retryPendingReply(deps: Deps, store: Store, chatId: string): Promise<void> {
	const pending = await store.get('pending_reply');
	if (!pending) return;
	const now = deps.now();
	if (now.getTime() - new Date(pending).getTime() > 6 * 3600_000) {
		await store.del('pending_reply');
		return;
	}
	// Retry every 15 minutes, not every tick, so a quota outage isn't made worse.
	const lastTry = Number((await store.get('pending_reply_try')) ?? 0);
	if (now.getTime() - lastTry < 15 * 60_000) return;
	await store.set('pending_reply_try', String(now.getTime()));
	let reply: string;
	try {
		reply = (await replyTo(deps, store, now)).text;
	} catch {
		return; // still down; try again next tick
	}
	await store.del('pending_reply');
	await say(deps, chatId, reply, { voice: false, kind: 'chat' });
}
