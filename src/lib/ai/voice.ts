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

/**
 * The voices on the family's own ElevenLabs account.
 *
 * A parent who has recorded or cloned a voice for each child needs to see *those*, by name —
 * a fixed list of stock voices is no use to them. Falls back to the stock list when there is
 * no key or the account cannot be reached, so the picker is never empty.
 */
export type VoiceListing = {
  voices: VoiceOption[];
  /** True when these are the family's own voices rather than the built-in fallback list. */
  fromAccount: boolean;
  /** Why we fell back, when we did. Shown to the parent rather than swallowed. */
  problem: string | null;
};

type RawVoice = {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
};

function toOptions(raw: RawVoice[]): VoiceOption[] {
  return raw
    .filter((v): v is RawVoice & { voice_id: string; name: string } =>
      typeof v.voice_id === "string" && typeof v.name === "string",
    )
    .map((v) => ({
      id: v.voice_id,
      label: v.name,
      // The account's own labels — accent, age, gender — say more to a parent choosing a
      // teacher for their child than anything we could invent.
      description: [v.labels?.gender, v.labels?.age, v.labels?.accent, v.category]
        .filter(Boolean)
        .join(", "),
    }));
}

/**
 * The voices on the family's own ElevenLabs account.
 *
 * A parent who has made a voice for each child needs to see *those*, by name. Two endpoints
 * are tried because the newer paginated one is the current API and the older one still works
 * on some accounts — and if both fail, the reason is returned rather than swallowed. Falling
 * back silently to stock voices is what makes a parent ask why their own voices are missing.
 */
export async function listVoices(): Promise<VoiceListing> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { voices: VOICE_OPTIONS, fromAccount: false, problem: "No ELEVENLABS_API_KEY on the server." };
  }

  const headers = { "xi-api-key": apiKey };
  const problems: string[] = [];

  // The current endpoint, paged until it says there is no more.
  try {
    const collected: RawVoice[] = [];
    let pageToken: string | null = null;

    for (let page = 0; page < 10; page++) {
      const url = new URL("https://api.elevenlabs.io/v2/voices");
      url.searchParams.set("page_size", "100");
      if (pageToken) url.searchParams.set("next_page_token", pageToken);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res: Response = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);

      if (!res.ok) {
        problems.push(`v2/voices returned ${res.status}`);
        break;
      }

      const body = (await res.json()) as {
        voices?: RawVoice[];
        has_more?: boolean;
        next_page_token?: string | null;
      };
      collected.push(...(body.voices ?? []));
      if (!body.has_more || !body.next_page_token) break;
      pageToken = body.next_page_token;
    }

    if (collected.length > 0) {
      return { voices: toOptions(collected), fromAccount: true, problem: null };
    }
  } catch (err) {
    problems.push(`v2/voices failed: ${err instanceof Error ? err.message : "request failed"}`);
  }

  // Older accounts and older keys still answer here.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.ok) {
      const body = (await res.json()) as { voices?: RawVoice[] };
      const voices = toOptions(body.voices ?? []);
      if (voices.length > 0) return { voices, fromAccount: true, problem: null };
      problems.push("the account returned no voices");
    } else {
      problems.push(
        res.status === 401
          ? "ElevenLabs rejected the key"
          : `v1/voices returned ${res.status}`,
      );
    }
  } catch (err) {
    problems.push(`v1/voices failed: ${err instanceof Error ? err.message : "request failed"}`);
  }

  return {
    voices: VOICE_OPTIONS,
    fromAccount: false,
    problem: problems.join("; ") || "Could not reach ElevenLabs.",
  };
}

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
/**
 * The model to speak with.
 *
 * ElevenLabs' conversational model is built for exactly this — back-and-forth speech at low
 * latency, with the expressiveness a teacher explaining something needs. Model names move
 * faster than this file will, so the preferred one is configurable and there is a fallback:
 * if the account or the API does not recognise it, we try a well-established model rather
 * than leaving a child with a teacher who has lost her voice.
 */
const PREFERRED_MODEL = process.env.ELEVENLABS_MODEL_ID ?? "eleven_v3_conversational";
const FALLBACK_MODEL = "eleven_turbo_v2_5";

async function requestSpeech(text: string, voiceId: string, modelId: string, apiKey: string) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
}

export async function speak(text: string, voiceId: string): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new VoiceUnavailable("No ELEVENLABS_API_KEY is set on the server.");

  const trimmed = text.trim().slice(0, 2500);
  if (!trimmed) throw new VoiceUnavailable("Nothing to say.");

  let res = await requestSpeech(trimmed, voiceId, PREFERRED_MODEL, apiKey);

  // 400/422 from this endpoint is usually "that model id means nothing to me". Worth one
  // retry on a model we know exists before telling a child the teacher cannot speak.
  if ((res.status === 400 || res.status === 422) && PREFERRED_MODEL !== FALLBACK_MODEL) {
    res = await requestSpeech(trimmed, voiceId, FALLBACK_MODEL, apiKey);
  }

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

/**
 * Turns a child's recorded speech into text.
 *
 * Typing is a tax on thinking for a nine year old — a question they would ask out loud in a
 * second takes a minute to peck out, so they stop asking. Speaking to the teacher removes it.
 */
export async function transcribe(audio: Blob | ArrayBuffer, filename = "speech.webm"): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new VoiceUnavailable("No ELEVENLABS_API_KEY is set on the server.");

  const blob = audio instanceof Blob ? audio : new Blob([audio]);
  if (blob.size === 0) throw new VoiceUnavailable("Nothing was recorded.");

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL_ID ?? "scribe_v1");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new VoiceUnavailable(
      res.status === 401
        ? "ElevenLabs rejected the key."
        : `Could not make out the recording (${res.status}). ${detail.slice(0, 200)}`,
    );
  }

  const body = (await res.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) throw new VoiceUnavailable("Nothing was said, or it was too quiet to hear.");
  return text;
}
