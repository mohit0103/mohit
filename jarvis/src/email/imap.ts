// A minimal read-only IMAP client: just enough to log in, search Gmail and fetch new messages.
import type { MailMessage, MailSource } from '../types';
import { parseMessage } from './mime';

export interface Duplex {
	readable: ReadableStream<Uint8Array>;
	writable: WritableStream<Uint8Array>;
	close(): Promise<void> | void;
}

type Part = { text: string } | { literal: Uint8Array };
export interface ImapResponse {
	parts: Part[];
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export class ImapConnection {
	private reader: ReadableStreamDefaultReader<Uint8Array>;
	private writer: WritableStreamDefaultWriter<Uint8Array>;
	private buf = new Uint8Array(0);
	private tag = 0;

	constructor(
		private sock: Duplex,
		private timeoutMs = 20_000,
	) {
		this.reader = sock.readable.getReader();
		this.writer = sock.writable.getWriter();
	}

	private async fill(): Promise<void> {
		const read = this.reader.read();
		const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('imap read timed out')), this.timeoutMs));
		const { value, done } = await Promise.race([read, timeout]);
		if (done) throw new Error('imap connection closed');
		const next = new Uint8Array(this.buf.length + value.length);
		next.set(this.buf);
		next.set(value, this.buf.length);
		this.buf = next;
	}

	private async readLine(): Promise<string> {
		for (;;) {
			const i = this.buf.indexOf(10);
			if (i >= 0) {
				const line = dec.decode(this.buf.subarray(0, i)).replace(/\r$/, '');
				this.buf = this.buf.subarray(i + 1);
				return line;
			}
			await this.fill();
		}
	}

	private async readBytes(n: number): Promise<Uint8Array> {
		while (this.buf.length < n) await this.fill();
		const out = this.buf.slice(0, n);
		this.buf = this.buf.subarray(n);
		return out;
	}

	/** One full server response, following any {n} literals. */
	private async readResponse(): Promise<ImapResponse> {
		const parts: Part[] = [];
		for (;;) {
			const line = await this.readLine();
			const m = /\{(\d+)\}$/.exec(line);
			if (!m) {
				parts.push({ text: line });
				return { parts };
			}
			parts.push({ text: line.slice(0, m.index) });
			parts.push({ literal: await this.readBytes(Number(m[1])) });
		}
	}

	async greeting(): Promise<void> {
		const r = await this.readResponse();
		const t = firstText(r);
		if (!/^\* (OK|PREAUTH)/i.test(t)) throw new Error(`imap greeting: ${t}`);
	}

	/** Sends a command and returns the untagged responses. Throws on NO/BAD. */
	async command(cmd: string, redact = false): Promise<ImapResponse[]> {
		const tag = `J${++this.tag}`;
		await this.writer.write(enc.encode(`${tag} ${cmd}\r\n`));
		const out: ImapResponse[] = [];
		for (;;) {
			const r = await this.readResponse();
			const t = firstText(r);
			if (t.startsWith(`${tag} `)) {
				if (!/^\S+ OK/i.test(t)) throw new Error(`imap ${redact ? cmd.split(' ')[0] : cmd} failed: ${t.slice(tag.length + 1, 200)}`);
				return out;
			}
			if (t.startsWith('+')) throw new Error('imap unexpected continuation');
			out.push(r);
		}
	}

	async close(): Promise<void> {
		try {
			await this.command('LOGOUT');
		} catch {
			// ignore
		}
		try {
			await this.sock.close();
		} catch {
			// ignore
		}
	}
}

function firstText(r: ImapResponse): string {
	const p = r.parts[0];
	return p && 'text' in p ? p.text : '';
}

export function quote(s: string): string {
	return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const GMAIL_FILTER = '-category:promotions -category:social -in:chats';

export class ImapMail implements MailSource {
	constructor(
		private user: string,
		private password: string,
		private open: () => Promise<Duplex>,
	) {}

	async fetchNew(sinceUid: number, max: number): Promise<{ messages: MailMessage[]; lastUid: number }> {
		const conn = new ImapConnection(await this.open());
		try {
			await conn.greeting();
			await conn.command(`LOGIN ${quote(this.user)} ${quote(this.password.replace(/\s+/g, ''))}`, true);
			await conn.command('EXAMINE "INBOX"'); // read-only: never marks mail as read
			const window = sinceUid ? 'newer_than:3d' : 'newer_than:1d';
			const found = await conn.command(`UID SEARCH X-GM-RAW ${quote(`${window} ${GMAIL_FILTER}`)}`);
			const uids = parseSearch(found).filter((u) => u > sinceUid);
			const lastUid = Math.max(sinceUid, ...uids);
			const pick = uids.slice(-max);
			if (!pick.length) return { messages: [], lastUid };
			const fetched = await conn.command(
				`UID FETCH ${pick.join(',')} (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.8000>)`,
			);
			const messages = fetched.map(parseFetch).filter((m): m is MailMessage => m !== null);
			messages.sort((a, b) => a.uid - b.uid);
			return { messages, lastUid };
		} finally {
			await conn.close();
		}
	}
}

export function parseSearch(responses: ImapResponse[]): number[] {
	const uids: number[] = [];
	for (const r of responses) {
		const t = firstText(r);
		const m = /^\* SEARCH\s*(.*)$/i.exec(t);
		if (m) for (const n of m[1].trim().split(/\s+/)) if (/^\d+$/.test(n)) uids.push(Number(n));
	}
	return uids.sort((a, b) => a - b);
}

export function parseFetch(r: ImapResponse): MailMessage | null {
	const allText = r.parts.map((p) => ('text' in p ? p.text : '')).join(' ');
	if (!/^\* \d+ FETCH/i.test(allText)) return null;
	const uid = Number(/UID (\d+)/i.exec(allText)?.[1]);
	if (!uid) return null;
	const date = /INTERNALDATE "([^"]+)"/i.exec(allText)?.[1];
	let header = '';
	let body: Uint8Array = new Uint8Array();
	for (let i = 0; i < r.parts.length; i++) {
		const p = r.parts[i];
		if (!('literal' in p)) continue;
		const before = r.parts[i - 1];
		const label = before && 'text' in before ? before.text : '';
		if (/HEADER\.FIELDS/i.test(label)) header = dec.decode(p.literal);
		else if (/BODY\[TEXT\]/i.test(label)) body = p.literal;
	}
	const parsed = parseMessage(header, body);
	return {
		uid,
		from: parsed.from,
		subject: parsed.subject,
		date: parseImapDate(date) ?? new Date(),
		text: parsed.text,
	};
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseImapDate(s: string | undefined): Date | null {
	const m = s && /^\s*(\d{1,2})-(\w{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})/.exec(s);
	if (!m) return null;
	const mon = MONTHS[m[2].toLowerCase()];
	if (mon === undefined) return null;
	const offset = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]));
	return new Date(Date.UTC(Number(m[3]), mon, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - offset * 60_000);
}

/** Opens a TLS socket to Gmail from inside a Worker. */
export async function gmailSocket(): Promise<Duplex> {
	const { connect } = await import('cloudflare:sockets');
	const s = connect({ hostname: 'imap.gmail.com', port: 993 }, { secureTransport: 'on', allowHalfOpen: false });
	return { readable: s.readable, writable: s.writable, close: () => s.close() };
}
