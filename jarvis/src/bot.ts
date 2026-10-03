// Handles incoming Telegram updates: pairing, commands, buttons, and conversation.
import { MEMORY_RULES, applyMemory, memorySchema, type MemoryOps } from './memory';
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
	if (imageFileId) {
		await deps.tg.sendChatAction(chatId, 'typing');
		let image: Uint8Array | null = null;
		try {
			image = await deps.tg.getFile(imageFileId);
		} catch (e) {
			console.warn('photo download failed', e);
		}
		if (!image) {
			await deps.tg.sendMessage(chatId, "Couldn't load that photo, man. Mind sending it again?");
			return;
		}
		const mime = msg.document?.mime_type ?? 'image/jpeg';
		return converse(deps, store, chatId, text ? `[sent a photo] ${text}` : '[sent a photo]', false, {}, [{ mime, data: image }]);
	}
	if (msg.document || msg.sticker || msg.video || msg.video_note) {
		if (!text) {
			await deps.tg.sendMessage(chatId, "I can't open videos or files yet, but photos work! Tell me what it is?");
			return;
		}
	}
	if (!text) return;
	return converse(deps, store, chatId, text, false);
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
	if (deps.mail && /\b(e-?mails?|inbox|gmail|mails?)\b/i.test(text)) {
		const tm = Date.now();
		await checkMailNow(deps, store, now, 8_000);
		timings.email = Date.now() - tm;
	}
	let reply: string;
	const tl = Date.now();
	try {
		reply = await replyTo(deps, store, now, images);
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
	const meta = Object.entries({ ...timings, voice: viaVoice ? 1 : 0 }).map(([k, v]) => `${k}=${v}`).join(' ');
	await say(deps, chatId, reply, { voice: viaVoice, kind: 'chat', meta });
	timings.send = Date.now() - ts;
	timings.total = Date.now() - t0 + (timings.listen ?? 0);
	await store.del('pending_reply');
	await store.diag('brain', true, 'replying normally', utc(now));
	await store.diag('latency', true, Object.entries(timings).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`).join(', '), utc(now));
	await rememberExchange(deps, store, now, text, reply);
}

const STYLE_TAIL = `Reply with just your message to him: plain spoken words in your buddy voice, usually 1-3 short sentences (more only if he asks).
If he tells you how a plan went, react like a friend. If he asks to be reminded, confirm casually with the time.
If he asks what you know about him, sum it up warmly. If he says "forget that", say you've forgotten it.
Never claim you did something you cannot do (send an email, book something).
When you can't do something yourself (book tickets, pay, call someone), never stop at "I can't": offer the next best thing,
like searching the options and prices, the quickest way to do it, or offering a reminder at a sensible time.
Don't repeat the same nudge (an unbooked ticket, a pending task) more than once in a conversation unless he brings it up.
His messages are often voice transcriptions, so words and Indian place names can be misheard: work out the likely meaning
(e.g. "Hodi" is probably Hoodi in Bengaluru) instead of saying you don't know a place.
He travels; for weather or places use where he says he is now, not just his home city. You can't see live traffic or his GPS:
for routes, give the typical travel time and say Maps will show live traffic.
If he sends a photo, actually look at it and react to what's in it like a friend would.
You can look things up with Google Search: use it for facts, news, scores, prices, weather, places, recommendations he asks for,
how-tos, anything current or anything you're unsure of. Search instead of saying "I don't know". Answer in your own words in
your buddy voice; never read out links, sources or citations.`;

function emailNote(deps: Deps): string {
	return deps.mail
		? `EMAIL: you DO have read-only access to his Gmail. Summaries of important emails from the last 3 days are under RECENT IMPORTANT EMAILS (the inbox was just checked if he asked about mail). If he asks about email and none are listed, tell him casually that the inbox is quiet. Never say you lack email access, and never mention a calendar (you only see what he tells you and what email says).`
		: `EMAIL: his Gmail is not connected yet. If he asks, tell him to add GMAIL_ADDRESS and GMAIL_APP_PASSWORD (see SETUP.md).`;
}

async function replyTo(deps: Deps, store: Store, now: Date, images: { mime: string; data: Uint8Array }[] = []): Promise<string> {
	const [snapshot, recent] = await Promise.all([memorySnapshot(store, now), store.recentMessages(20)]);
	const system = `${persona(deps.config.name, deps.config.city)}\n\n${timeContext(now)}\n\nWHAT YOU KNOW:\n${snapshot}\n\n${emailNote(deps)}\n\n${STYLE_TAIL}`;
	const text = await deps.llm.generate({ system, turns: toTurns(recent), temperature: 0.95, fast: true, search: true, images });
	const reply = cleanReply(text);
	if (!reply) throw new LlmError('empty reply', 'bad_response');
	return reply;
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

/** Second, unhurried call: what from this exchange should be remembered? Failures are logged, never shown. */
async function rememberExchange(deps: Deps, store: Store, now: Date, said: string, reply: string): Promise<void> {
	try {
		const [snapshot, recent] = await Promise.all([memorySnapshot(store, now), store.recentMessages(12)]);
		const transcript = recent.map((m) => `${m.role === 'user' ? deps.config.name : 'Jarvis'}: ${m.text}`).join('\n');
		const ops = await generateJson<MemoryOps>(deps.llm, {
			system: `You maintain the long-term memory of ${deps.config.name}'s AI buddy, Jarvis.\n\n${timeContext(now)}\n\nWHAT IS ALREADY KNOWN:\n${snapshot}\n\n${MEMORY_RULES}`,
			turns: [
				{
					role: 'user',
					text: `Recent conversation:\n${transcript}\n\nLatest message from ${deps.config.name}: "${said}"\nJarvis replied: "${reply}"\n\nReturn the memory updates for this latest exchange as JSON.`,
				},
			],
			schema: memorySchema,
			temperature: 0.2,
		});
		await applyMemory(store, ops, now);
	} catch (e) {
		console.error('memory update failed', e);
		await store.diag('memory', false, String(e), utc(now));
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
	let reply: string;
	try {
		reply = await replyTo(deps, store, now);
	} catch {
		return; // still down; try again next tick
	}
	await store.del('pending_reply');
	const said = (await store.recentMessages(5)).filter((m) => m.role === 'user').at(-1)?.text ?? '';
	await say(deps, chatId, reply, { voice: false, kind: 'chat' });
	await rememberExchange(deps, store, now, said, reply);
}
