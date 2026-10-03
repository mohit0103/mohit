// Shared interfaces. Everything external sits behind one of these so tests can swap in fakes.

export interface Env {
	DB: D1Database;
	AI: Ai;
	TELEGRAM_BOT_TOKEN: string;
	GEMINI_API_KEY: string;
	PAIR_CODE?: string;
	OWNER_CHAT_ID?: string;
	GMAIL_ADDRESS?: string;
	GMAIL_APP_PASSWORD?: string;
	GEMINI_MODELS?: string;
	TTS_SPEAKER?: string;
	TTS_DAILY_CHARS?: string;
	ELEVENLABS_API_KEY?: string;
	ELEVENLABS_MONTHLY_CHARS?: string;
	CITY?: string;
	CITY_LAT?: string;
	CITY_LON?: string;
}

export interface InlineButton {
	text: string;
	data: string;
}

export interface Telegram {
	sendMessage(chatId: string, text: string, buttons?: InlineButton[][]): Promise<void>;
	sendVoice(chatId: string, audio: Uint8Array, mime: string, caption?: string): Promise<void>;
	sendChatAction(chatId: string, action: 'typing' | 'record_voice'): Promise<void>;
	getFile(fileId: string): Promise<Uint8Array>;
	answerCallback(id: string, text?: string): Promise<void>;
	sendDocument(chatId: string, data: Uint8Array, filename: string, caption?: string): Promise<void>;
}

/** A JSON schema in Gemini's OpenAPI subset. */
export type Schema = Record<string, unknown>;

export interface LlmRequest {
	system: string;
	/** Conversation turns; the last one is the user's. */
	turns: { role: 'user' | 'model'; text: string }[];
	schema?: Schema;
	temperature?: number;
	audio?: { mime: string; data: Uint8Array };
	/** Latency-sensitive: turn model thinking down to the minimum. */
	fast?: boolean;
}

export interface Llm {
	/** Returns the raw text answer (JSON text when a schema is given). Throws LlmError when every model fails. */
	generate(req: LlmRequest): Promise<string>;
}

export class LlmError extends Error {
	constructor(
		message: string,
		readonly kind: 'quota' | 'unavailable' | 'bad_response' | 'config',
	) {
		super(message);
	}
}

export interface Speech {
	transcribe(audio: Uint8Array, mime: string): Promise<string>;
	/** Returns null when speech is unavailable or over budget; the caller sends text instead. */
	synthesize(text: string, voice?: string): Promise<{ audio: Uint8Array; mime: string } | null>;
}

export interface Weather {
	summary: string;
}

export interface Feeds {
	weather(): Promise<Weather | null>;
	news(): Promise<string[]>;
}

export interface MailMessage {
	uid: number;
	from: string;
	subject: string;
	date: Date;
	text: string;
}

export interface MailSource {
	/** New messages after `sinceUid` (oldest first), capped at `max`. */
	fetchNew(sinceUid: number, max: number): Promise<{ messages: MailMessage[]; lastUid: number }>;
}

export interface Deps {
	db: D1Database;
	tg: Telegram;
	llm: Llm;
	speech: Speech;
	feeds: Feeds;
	mail: MailSource | null;
	now: () => Date;
	random: () => number;
	config: {
		ownerChatId?: string;
		pairCode?: string;
		name: string;
		city: string;
	};
}
