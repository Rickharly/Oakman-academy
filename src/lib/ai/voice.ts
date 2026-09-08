/**
 * The teacher's voice.
 *
 * Reading is not the only way to be taught, and for a nine-year-old it is often the worst one.
 * A teacher who talks lets a child listen to an explanation the way they would in a classroom,
 * and lets them keep their eyes on the thing being explained.
 *
 * Text-to-speech is optional throughout: with no key configured, or a request that fails, the
 * app carries on exactly as before with the words on screen. A voice is an addition to the
 * teaching, never the only copy of it.
 */
export type VoiceOption = { id: string; label: string; description: string };

/**
 * A short list a parent can choose from without leaving the app. Any ElevenLabs voice id can
 * be pasted in instead — these are only a sensible starting point.
 */
export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Warm, clear, unhurried. A good default for most children." },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", description: "Younger and brighter." },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", description: "Steady and friendly." },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "Younger, a little more energy." },
];

export const DEFAULT_VOICE_ID = VOICE_OPTIONS[0].id;

export class VoiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceUnavailable";
  }
}

/**
 * Turns text into speech.
 *
 * `model_id` and the voice settings are chosen for a child listening to an explanation:
 * clarity over character, and a little stability so the voice does not wander mid-sentence.
 */
export async function speak(text: string, voiceId: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new VoiceUnavailable("No ELEVENLABS_API_KEY is set on the server.");

  const trimmed = text.trim().slice(0, 2500);
  if (!trimmed) throw new VoiceUnavailable("Nothing to say.");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new VoiceUnavailable(
      res.status === 401
        ? "ElevenLabs rejected the key."
        : `ElevenLabs returned ${res.status}. ${detail.slice(0, 200)}`,
    );
  }

  return { audio: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "audio/mpeg" };
}
