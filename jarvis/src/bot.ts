// Handles incoming Telegram updates: pairing, commands, buttons, and conversation.
import { MEMORY_RULES, applyMemory, memorySchema, type MemoryOps } from './memory';
import { memorySnapshot, persona, planLine, timeContext } from './context';
import { generateJson } from './services';
import { ownerChat, say } from './say';
import { Store } from './store';
import { addDays, atLocal, human, localDate, utc } from './time';
import { LlmError, type Deps } from './types';
import { runBriefing, runCheckin } from './scheduler';

const HELP = `Hey! I'm Jarvis. Just talk to me, by voice note or text. I remember what you tell me, remind you about things, and check in on you.

Things you can say: "remind me to call mom at 8", "Friday I have a dentist appointment", "what do you know about me?", "forget that".

Commands:
/memory - what I remember
/plans - upcoming plans and reminders
/briefing - morning briefing now
/checkin - evening check-in now
/pause 3 - no proactive messages for 3 hours (/resume to undo)
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
		return converse(deps, store, chatId, heard, true);
	}
	if (msg.photo || msg.document || msg.sticker || msg.video) {
		if (!text) {
			await deps.tg.sendMessage(chatId, "I can't look at photos or files yet, but tell me about it!");
			return;
		}
	}
	if (!text) return;
	return converse(deps, store, chatId, text, false);
}

interface ChatReply {
	reply: string;
	memory: MemoryOps;
}

const chatSchema = {
	type: 'OBJECT',
	properties: { reply: { type: 'STRING' }, memory: memorySchema },
	required: ['reply', 'memory'],
};

/** One LLM call produces both the reply and the memory updates. */
export async function converse(deps: Deps, store: Store, chatId: string, text: string, viaVoice: boolean): Promise<void> {
	const now = deps.now();
	await store.addMessage('user', text, 'chat', utc(now));
	await deps.tg.sendChatAction(chatId, viaVoice ? 'record_voice' : 'typing');
	let result: ChatReply;
	try {
		result = await think(deps, store, now);
	} catch (e) {
		console.error('chat failed', e);
		const kind = e instanceof LlmError ? e.kind : 'unavailable';
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
	await store.del('pending_reply');
	try {
		await applyMemory(store, result.memory, now);
	} catch (e) {
		console.error('memory update failed', e);
	}
	const reply = (result.reply ?? '').trim() || 'Got it 👍';
	await say(deps, chatId, reply, { voice: viaVoice, kind: 'chat' });
}

async function think(deps: Deps, store: Store, now: Date): Promise<ChatReply> {
	const [snapshot, recent] = await Promise.all([memorySnapshot(store, now), store.recentMessages(20)]);
	const system = `${persona(deps.config.name, deps.config.city)}

${timeContext(now)}

WHAT YOU KNOW:
${snapshot}

${MEMORY_RULES}

Reply with JSON: {"reply": what you say back (1-4 short spoken sentences unless he asks for more), "memory": {...}}.
If he answers a follow-up about a plan, react to it like a friend and mark the plan done with the outcome.
If he asks what you know about him, summarise warmly. If he says "forget that", remove the matching facts.
Never claim you did something (sent an email, booked something) that you cannot do.`;
	const turns = toTurns(recent);
	const r = await generateJson<ChatReply>(deps.llm, { system, turns, schema: chatSchema, temperature: 0.8 });
	if (typeof r?.reply !== 'string') throw new LlmError('reply missing', 'bad_response');
	return r;
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
	if (kind === 'a' && Number.isInteger(id)) {
		await store.setAdminStatus(id, action === 'done' ? 'done' : 'open');
		return deps.tg.answerCallback(cq.id, 'Marked done ✅');
	}
	return deps.tg.answerCallback(cq.id);
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
	let result: ChatReply;
	try {
		result = await think(deps, store, now);
	} catch {
		return; // still down; try again next tick
	}
	await store.del('pending_reply');
	await applyMemory(store, result.memory, now).catch((e) => console.error('memory update failed', e));
	await say(deps, chatId, result.reply || 'Sorry for the delay! I\'m back.', { voice: false, kind: 'chat' });
}
