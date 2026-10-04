// Sending messages to Mohit, as voice or text, and logging them in the conversation history.
import { Store } from './store';
import type { Deps, InlineButton } from './types';
import { utc } from './time';

export async function ownerChat(deps: Deps, store: Store): Promise<string | null> {
	return deps.config.ownerChatId || (await store.get('owner_chat_id'));
}

export interface SayOptions {
	voice: boolean;
	kind: string;
	buttons?: InlineButton[][];
	/** Extra text sent after the voice note (details not worth reading aloud, like lists). */
	details?: string;
	/** Stored with the message for review (e.g. timings). */
	meta?: string;
}

/** Sends a message. Voice falls back to text if speech fails; a send failure is logged, not thrown, after one retry. */
export async function say(deps: Deps, chatId: string, text: string, opts: SayOptions): Promise<void> {
	const store = new Store(deps.db);
	let sentVoice = false;
	// Messages Jarvis starts himself (briefing, check-in, follow-ups) land as text plus a tap-to-play audio file:
	// Telegram auto-plays voice messages in a queue (and on raise-to-ear), which he doesn't want for these.
	if (opts.voice && opts.kind !== 'chat') {
		const full = opts.details ? `${text}\n\n${opts.details}` : text;
		await retry(() => deps.tg.sendMessage(chatId, full, opts.buttons));
		try {
			const audio = await Promise.race([deps.speech.synthesize(text), new Promise<null>((r) => setTimeout(() => r(null), 12_000))]);
			if (audio) await deps.tg.sendAudio(chatId, audio.audio, audio.mime, AUDIO_TITLES[opts.kind] ?? 'Jarvis');
		} catch (e) {
			console.warn('audio send failed; the text already went out', e);
		}
		await store.addMessage('jarvis', text, opts.kind, utc(deps.now()), opts.meta ?? '');
		return;
	}
	if (opts.voice) {
		try {
			await deps.tg.sendChatAction(chatId, 'record_voice');
			const audio = await Promise.race([deps.speech.synthesize(text), new Promise<null>((r) => setTimeout(() => r(null), 12_000))]);
			if (audio) {
				const caption = text.length <= 1000 && !opts.details ? text : undefined;
				await deps.tg.sendVoice(chatId, audio.audio, audio.mime, caption);
				sentVoice = true;
				if (!caption) await retry(() => deps.tg.sendMessage(chatId, opts.details ? `${text}\n\n${opts.details}` : text, opts.buttons));
				else if (opts.buttons) await retry(() => deps.tg.sendMessage(chatId, '👆', opts.buttons));
			}
		} catch (e) {
			console.warn('voice send failed, falling back to text', e);
		}
	}
	if (!sentVoice) {
		const full = opts.details ? `${text}\n\n${opts.details}` : text;
		await retry(() => deps.tg.sendMessage(chatId, full, opts.buttons));
	}
	await store.addMessage('jarvis', text, opts.kind, utc(deps.now()), opts.meta ?? '');
}

const AUDIO_TITLES: Record<string, string> = {
	briefing: 'Morning briefing',
	checkin: 'Evening check-in',
	review: 'Weekly review',
	monthly: 'Monthly recap',
	followup: 'Jarvis',
};

async function retry(fn: () => Promise<void>): Promise<void> {
	try {
		await fn();
	} catch (e) {
		console.warn('send failed, retrying once', e);
		await new Promise((r) => setTimeout(r, 1000));
		await fn();
	}
}
