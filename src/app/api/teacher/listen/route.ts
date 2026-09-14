import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { transcribe, VoiceUnavailable } from "@/lib/ai/voice";

/**
 * Turns a child's recorded question into text, so they can talk to their teacher instead of
 * typing at her. Nothing is stored: the audio is transcribed and discarded, and only the words
 * go on to the conversation, where they are already kept.
 */
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // about two minutes of speech

export async function POST(req: Request) {
  try {
    await requireStudentApi(req);

    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return Response.json({ error: "No recording was sent." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "That recording is too long." }, { status: 413 });
    }

    // The browser names the recording after its real container (webm, mp4, …) — a Safari
    // recording is never actually webm, and hard-coding that extension here regardless of what
    // was sent told ElevenLabs to decode the wrong format for it.
    const filename = file instanceof File && file.name ? file.name : "speech.webm";
    const text = await transcribe(file, filename);
    return Response.json({ text });
  } catch (err) {
    if (err instanceof VoiceUnavailable) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    return jsonError(err);
  }
}
