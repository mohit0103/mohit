// Microsoft Edge "Read aloud" neural voices: free, natural-sounding, MP3 output.
// Same protocol as the edge-tts Python package (v7.2.8), over a WebSocket opened with fetch().
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0];
const BASE = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const WIN_EPOCH = 11644473600;

export interface Voice {
	engine: 'eleven' | 'edge';
	/** Edge voice id, or the ElevenLabs voice name (resolved to an id at runtime). */
	id: string;
	label: string;
}

export const VOICES: Record<string, Voice> = {
	chris: { engine: 'eleven', id: 'Chris', label: 'Chris: natural, laid-back (ElevenLabs)' },
	will: { engine: 'eleven', id: 'Will', label: 'Will: friendly, young (ElevenLabs)' },
	liam: { engine: 'eleven', id: 'Liam', label: 'Liam: upbeat, energetic (ElevenLabs)' },
	andrew: { engine: 'edge', id: 'en-US-AndrewMultilingualNeural', label: 'Andrew: warm, confident (Microsoft)' },
	brian: { engine: 'edge', id: 'en-US-BrianMultilingualNeural', label: 'Brian: casual, easy-going (Microsoft)' },
	prabhat: { engine: 'edge', id: 'en-IN-PrabhatNeural', label: 'Prabhat: Indian English (Microsoft)' },
};
export const DEFAULT_VOICE = 'chris';
/** Used when ElevenLabs is unavailable or its monthly allowance is spent. */
export const FALLBACK_EDGE_VOICE = 'andrew';
/** Slightly quicker than default so voice notes don't drag. */
export const EDGE_RATE = '+12%';

async function sha256Hex(s: string): Promise<string> {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
	return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The Sec-MS-GEC token: SHA-256 of Windows file time (rounded to 5 minutes) plus the client token. */
export async function secMsGec(nowMs: number): Promise<string> {
	let ticks = Math.floor(nowMs / 1000) + WIN_EPOCH;
	ticks -= ticks % 300;
	return sha256Hex(`${BigInt(ticks) * 10_000_000n}${TRUSTED_CLIENT_TOKEN}`);
}

const hex = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const jsDate = (d: Date) => `${d.toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) /, '$1 $3 $2 $4 ')} GMT+0000 (Coordinated Universal Time)`.replace(' GMT GMT', ' GMT');

export function escapeXml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function ssml(text: string, voiceId: string, rate = '+0%'): string {
	return (
		"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>" +
		`<voice name='${voiceId}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`
	);
}

/** Splits a binary frame: 2-byte big-endian header length, headers, then audio bytes. */
export function parseBinaryFrame(buf: Uint8Array): { path: string; audio: Uint8Array } {
	if (buf.length < 2) throw new Error('edge frame too short');
	const len = (buf[0] << 8) | buf[1];
	const header = new TextDecoder().decode(buf.subarray(2, 2 + len));
	const path = /Path:([^\r\n]+)/.exec(header)?.[1]?.trim() ?? '';
	return { path, audio: buf.subarray(2 + len) };
}

export async function edgeSynthesize(text: string, voiceId: string, opts: { fetcher?: typeof fetch; timeoutMs?: number; now?: () => number } = {}): Promise<Uint8Array> {
	const fetcher = opts.fetcher ?? ((i, init) => fetch(i, init));
	const now = opts.now ?? Date.now;
	const url = `${BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${hex(16)}&Sec-MS-GEC=${await secMsGec(now())}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;
	const res = await fetcher(url, {
		headers: {
			Upgrade: 'websocket',
			Pragma: 'no-cache',
			'Cache-Control': 'no-cache',
			Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
			'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
			'Accept-Language': 'en-US,en;q=0.9',
			Cookie: `muid=${hex(16).toUpperCase()};`,
		},
	});
	const ws = (res as any).webSocket as WebSocket | null;
	if (!ws) throw new Error(`edge tts handshake failed: ${res.status}`);
	(ws as any).accept();
	const chunks: Uint8Array[] = [];
	const done = new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('edge tts timed out')), opts.timeoutMs ?? 20_000);
		ws.addEventListener('message', (ev: MessageEvent) => {
			try {
				if (typeof ev.data === 'string') {
					if (/Path:turn\.end/.test(ev.data)) {
						clearTimeout(timer);
						resolve();
					}
					return;
				}
				const frame = parseBinaryFrame(new Uint8Array(ev.data as ArrayBuffer));
				if (frame.path === 'audio' && frame.audio.length) chunks.push(frame.audio.slice());
			} catch (e) {
				clearTimeout(timer);
				reject(e);
			}
		});
		ws.addEventListener('close', () => {
			clearTimeout(timer);
			resolve();
		});
		ws.addEventListener('error', () => {
			clearTimeout(timer);
			reject(new Error('edge tts socket error'));
		});
	});
	const stamp = jsDate(new Date(now()));
	ws.send(
		`X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
			'{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n',
	);
	ws.send(`X-RequestId:${hex(16)}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${stamp}Z\r\nPath:ssml\r\n\r\n${ssml(text, voiceId, EDGE_RATE)}`);
	try {
		await done;
	} finally {
		try {
			ws.close();
		} catch {
			// already closed
		}
	}
	const total = chunks.reduce((n, c) => n + c.length, 0);
	if (!total) throw new Error('edge tts returned no audio');
	const out = new Uint8Array(total);
	let o = 0;
	for (const c of chunks) {
		out.set(c, o);
		o += c.length;
	}
	return out;
}
