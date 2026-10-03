import { describe, expect, it } from 'vitest';
import { edgeSynthesize, escapeXml, parseBinaryFrame, secMsGec, ssml } from '../src/edge';

const enc = new TextEncoder();

function frame(headers: string, audio: Uint8Array): ArrayBuffer {
	const h = enc.encode(headers);
	const out = new Uint8Array(2 + h.length + audio.length);
	out[0] = h.length >> 8;
	out[1] = h.length & 0xff;
	out.set(h, 2);
	out.set(audio, 2 + h.length);
	return out.buffer;
}

/** A fake Workers WebSocket that answers like the Edge service. */
function fakeService(opts: { audio?: boolean } = {}) {
	const sent: string[] = [];
	const listeners: Record<string, ((ev: any) => void)[]> = {};
	const ws = {
		accept() {},
		addEventListener(t: string, fn: (ev: any) => void) {
			(listeners[t] ??= []).push(fn);
		},
		send(m: string) {
			sent.push(m);
			if (m.includes('Path:ssml')) {
				const emit = (data: unknown) => listeners.message?.forEach((fn) => fn({ data }));
				setTimeout(() => {
					emit('X-RequestId:1\r\nPath:turn.start\r\n\r\n{}');
					if (opts.audio !== false) {
						emit(frame('X-RequestId:1\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n', new Uint8Array([1, 2, 3])));
						emit(frame('X-RequestId:1\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n', new Uint8Array([4, 5])));
					}
					emit(frame('X-RequestId:1\r\nPath:audio\r\n', new Uint8Array()));
					emit('X-RequestId:1\r\nPath:turn.end\r\n\r\n{}');
				}, 1);
			}
		},
		close() {},
	};
	const calls: { url: string; headers: Record<string, string> }[] = [];
	const fetcher = (async (url: any, init: any) => {
		calls.push({ url: String(url), headers: init.headers });
		return { status: 101, webSocket: ws } as any;
	}) as typeof fetch;
	return { fetcher, sent, calls };
}

describe('Edge neural voice', () => {
	it('computes the same Sec-MS-GEC token as the edge-tts Python package', async () => {
		expect(await secMsGec(1791011700123)).toBe('C7669E218E5B44735F85DF844A1459ACEC73EAC3C18CE6823E9D02D3F306217F');
	});

	it('escapes text for SSML', () => {
		expect(escapeXml(`Tom & Jerry <3 "hi" it's`)).toBe('Tom &amp; Jerry &lt;3 &quot;hi&quot; it&apos;s');
		expect(ssml('a < b', 'en-US-AndrewMultilingualNeural')).toContain("<voice name='en-US-AndrewMultilingualNeural'>");
	});

	it('parses binary audio frames', () => {
		const f = parseBinaryFrame(new Uint8Array(frame('Path:audio\r\n', new Uint8Array([9, 8]))));
		expect(f.path).toBe('audio');
		expect([...f.audio]).toEqual([9, 8]);
	});

	it('speaks the protocol and joins the audio chunks', async () => {
		const svc = fakeService();
		const audio = await edgeSynthesize('Hey Mohit!', 'en-US-AndrewMultilingualNeural', { fetcher: svc.fetcher, now: () => 1791011700123 });
		expect([...audio]).toEqual([1, 2, 3, 4, 5]);
		expect(svc.calls[0].url).toContain('Sec-MS-GEC=C7669E21');
		expect(svc.calls[0].headers.Upgrade).toBe('websocket');
		expect(svc.sent[0]).toContain('Path:speech.config');
		expect(svc.sent[0]).toContain('audio-24khz-48kbitrate-mono-mp3');
		expect(svc.sent[1]).toMatch(/X-Timestamp:Sat Oct 03 2026 \d\d:\d\d:\d\d GMT\+0000 \(Coordinated Universal Time\)Z/);
		expect(svc.sent[1]).toContain('Hey Mohit!');
	});

	it('fails clearly when no audio comes back or the handshake is refused', async () => {
		await expect(edgeSynthesize('hi', 'v', { fetcher: fakeService({ audio: false }).fetcher })).rejects.toThrow(/no audio/);
		const refused = (async () => ({ status: 403, webSocket: null })) as unknown as typeof fetch;
		await expect(edgeSynthesize('hi', 'v', { fetcher: refused })).rejects.toThrow(/handshake failed: 403/);
	});
});
