// Shared interfaces. Everything external sits behind one of these so tests can swap in fakes.

export interface Env {
	DB: D1Database;
	/** Scratch database for live evals (never his real memory). */
	EVAL_DB?: D1Database;
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
	GROQ_API_KEY?: string;
	GROQ_MODELS?: string;
	CEREBRAS_API_KEY?: string;
	MISTRAL_API_KEY?: string;
	MISTRAL_MODELS?: string;
	NVIDIA_API_KEY?: string;
	NVIDIA_MODELS?: string;
	CEREBRAS_MODELS?: string;
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
	/** Images attached to the last turn (photos he sends). */
	images?: { mime: string; data: Uint8Array }[];
	/** Latency-sensitive: turn model thinking down to the minimum. */
	fast?: boolean;
	/** 'light' background work starts on the Lite models, which have their own (bigger) free quota. */
	tier?: 'best' | 'light';
	/** Let the model use Google Search for current or factual questions. */
	search?: boolean;
}

export interface Llm {
	/** Returns the raw text answer (JSON text when a schema is given). Throws LlmError when every model fails. */
	generate(req: LlmRequest): Promise<string>;
	/** One step of a tool-using agent: the model either answers or asks to run tools. Optional for simple brains. */
	agentStep?(req: AgentStepRequest): Promise<AgentStepResult>;
}

/** A tool the agent can call. Parameters use Gemini's OpenAPI subset (type names in capitals). */
export interface ToolSpec {
	name: string;
	description: string;
	parameters: Schema;
}

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
}

export type AgentMsg =
	| { role: 'user'; text: string }
	/** `raw` is the provider's own message (Gemini needs its thought signatures echoed back); `by` says which provider. */
	| { role: 'model'; text: string; calls: ToolCall[]; raw?: unknown; by?: string }
	| { role: 'tool'; results: { id: string; name: string; result: unknown }[] };

export interface AgentStepRequest {
	system: string;
	messages: AgentMsg[];
	tools: ToolSpec[];
	/** 'none' forces a plain answer (used on the last step). */
	toolChoice?: 'auto' | 'none';
	temperature?: number;
	fast?: boolean;
	/** Images attached to his latest message. */
	images?: { mime: string; data: Uint8Array }[];
}

export interface AgentStepResult {
	text: string;
	calls: ToolCall[];
	raw?: unknown;
	by?: string;
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
	/** Forecast for any place (geocoded), for a local date (YYYY-MM-DD) or today. */
	weatherFor?(place: string, date?: string): Promise<string | null>;
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
	/** Pause (used to gather photo albums). Tests pass an instant one. */
	sleep?: (ms: number) => Promise<void>;
	config: {
		ownerChatId?: string;
		pairCode?: string;
		name: string;
		city: string;
	};
}
