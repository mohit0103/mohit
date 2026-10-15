// Just enough MIME to turn a (possibly truncated) email into readable plain text.
import { decodeEntities } from '../services';

const latin1 = new TextDecoder('latin1');

export interface ParsedMessage {
	from: string;
	subject: string;
	text: string;
}

export function parseMessage(rawHeader: string, body: Uint8Array): ParsedMessage {
	const h = parseHeaders(rawHeader);
	const text = extractText(h['content-type'] ?? 'text/plain', h['content-transfer-encoding'] ?? '', latin1.decode(body), 0);
	return {
		from: decodeWords(h.from ?? '').slice(0, 200),
		subject: decodeWords(h.subject ?? '').slice(0, 300),
		text: text.replace(/\s+/g, ' ').trim().slice(0, 2000),
	};
}

export function parseHeaders(raw: string): Record<string, string> {
	const out: Record<string, string> = {};
	const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ');
	for (const line of unfolded.split(/\r?\n/)) {
		const i = line.indexOf(':');
		if (i <= 0) continue;
		const key = line.slice(0, i).trim().toLowerCase();
		if (!(key in out)) out[key] = line.slice(i + 1).trim();
	}
	return out;
}

/** Decodes RFC 2047 encoded words like =?UTF-8?B?...?= */
export function decodeWords(s: string): string {
	return s
		.replace(/\?=\s+=\?/g, '?==?')
		.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) => {
			try {
				const bytes = enc.toUpperCase() === 'B' ? base64Bytes(data) : qpBytes(data.replace(/_/g, ' '));
				return decodeBytes(bytes, charset);
			} catch {
				return data;
			}
		});
}

function extractText(contentType: string, transferEncoding: string, body: string, depth: number): string {
	const type = contentType.toLowerCase();
	if (type.startsWith('multipart/') && depth < 4) {
		const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
		if (!boundary) return '';
		const parts = body.split(`--${boundary}`).slice(1);
		let html = '';
		for (const part of parts) {
			if (part.startsWith('--')) break;
			const split = part.search(/\r?\n\r?\n/);
			const headers = parseHeaders(split >= 0 ? part.slice(0, split) : part);
			const content = split >= 0 ? part.slice(split).replace(/^\r?\n\r?\n/, '') : '';
			const ct = headers['content-type'] ?? 'text/plain';
			if (/attachment/i.test(headers['content-disposition'] ?? '')) continue;
			if (/^text\/plain/i.test(ct)) {
				const t = extractText(ct, headers['content-transfer-encoding'] ?? '', content, depth + 1);
				if (t.trim()) return t;
			} else if (/^text\/html/i.test(ct) && !html) {
				html = extractText(ct, headers['content-transfer-encoding'] ?? '', content, depth + 1);
			} else if (/^multipart\//i.test(ct)) {
				const t = extractText(ct, '', content, depth + 1);
				if (t.trim()) return t;
			}
		}
		return html;
	}
	const charset = /charset="?([^";]+)"?/i.exec(contentType)?.[1] ?? 'utf-8';
	const te = transferEncoding.toLowerCase();
	let bytes: Uint8Array;
	if (te.includes('base64')) bytes = base64Bytes(body);
	else if (te.includes('quoted-printable')) bytes = qpBytes(body);
	else bytes = latin1Bytes(body);
	const text = decodeBytes(bytes, charset);
	return type.startsWith('text/html') ? htmlToText(text) : text;
}

export function htmlToText(html: string): string {
	return decodeEntities(
		html
			.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
			.replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
			.replace(/<[^>]+>/g, ' ')
			.replace(/<[^>]*$/, ''), // a tag cut off by truncation
	)
		.replace(/[ \t ]+/g, ' ')
		.replace(/\n\s*\n+/g, '\n')
		.trim();
}

function base64Bytes(s: string): Uint8Array {
	let clean = s.replace(/[^A-Za-z0-9+/]/g, '');
	// Restore stripped padding; a truncated fetch can also cut mid-quantum (a lone extra char is dropped).
	const rem = clean.length % 4;
	if (rem === 1) clean = clean.slice(0, -1);
	else if (rem) clean += '='.repeat(4 - rem);
	const bin = atob(clean);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function qpBytes(s: string): Uint8Array {
	const src = s.replace(/=\r?\n/g, '');
	const out: number[] = [];
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) {
			out.push(parseInt(src.slice(i + 1, i + 3), 16));
			i += 2;
		} else out.push(src.charCodeAt(i) & 0xff);
	}
	return new Uint8Array(out);
}

function latin1Bytes(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
	return out;
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
	try {
		return new TextDecoder(charset.trim().toLowerCase()).decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}
