// ElevenLabs text-to-speech: the most human voices. The free plan has a monthly character allowance,
// so usage is metered and Jarvis falls back to Microsoft voices once it is spent.
import { Store } from './store';

const API = 'https://api.elevenlabs.io/v1';
/** Known id for Chris, used if the voice list can't be fetched. */
const KNOWN: Record<string, string> = { chris: 'iP95p4xoKVk53GoZ742B' };

export class ElevenLabs {
	constructor(
		private key: string,
		private store: Store,
		private monthlyChars: number,
		private fetcher: typeof fetch = (i, init) => fetch(i, init),
	) {}

	/** Resolves a premade voice name to its id, cached in the store. */
	async voiceId(name: string): Promise<string> {
		const cacheKey = `el_voice:${name.toLowerCase()}`;
		const cached = await this.store.get(cacheKey);
		if (cached) return cached;
		const res = await this.fetcher(`${API}/voices`, { headers: { 'xi-api-key': this.key } });
		if (res.ok) {
			const data: any = await res.json();
			const v = (data.voices ?? []).find((x: any) => String(x.name ?? '').toLowerCase().startsWith(name.toLowerCase()));
			if (v?.voice_id) {
				await this.store.set(cacheKey, v.voice_id);
				return v.voice_id;
			}
		}
		const known = KNOWN[name.toLowerCase()];
		if (known) return known;
		throw new Error(`ElevenLabs voice "${name}" not found (${res.status})`);
	}

	/** Returns MP3 audio, or throws (over allowance, bad key, network). */
	async synthesize(text: string, voiceName: string, day: string): Promise<Uint8Array> {
		const month = day.slice(0, 7);
		const usedKey = `el_chars:${month}`;
		const used = Number((await this.store.get(usedKey)) ?? 0);
		if (used + text.length > this.monthlyChars) throw new Error(`monthly allowance used (${used}/${this.monthlyChars} characters)`);
		if ((await this.store.get(`el_blocked:${month}`)) === '1') throw new Error('ElevenLabs quota used up this month');
		if ((await this.store.get(`el_blocked:${day}`)) === '1') throw new Error('ElevenLabs refused the API key earlier today');
		const id = await this.voiceId(voiceName);
		const res = await this.fetcher(`${API}/text-to-speech/${id}?output_format=mp3_44100_64`, {
			method: 'POST',
			headers: { 'xi-api-key': this.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
			body: JSON.stringify({
				text,
				model_id: 'eleven_flash_v2_5',
				voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.3, speed: 1.08 },
			}),
		});
		if (!res.ok) {
			const detail = (await res.text().catch(() => '')).slice(0, 160);
			// Don't hammer a refusal: quota waits for next month, a bad key for tomorrow (or a redeploy).
			if (res.status === 402 || /quota/i.test(detail)) await this.store.set(`el_blocked:${month}`, '1');
			else if (res.status === 401) await this.store.set(`el_blocked:${day}`, '1');
			throw new Error(`ElevenLabs ${res.status}: ${detail}`);
		}
		const audio = new Uint8Array(await res.arrayBuffer());
		if (audio.length < 100) throw new Error('ElevenLabs returned no audio');
		await this.store.set(usedKey, String(used + text.length));
		return audio;
	}
}
