import { z } from "zod";
import { requireParentApi, jsonError } from "@/lib/auth/api";
import { speak, VoiceUnavailable } from "@/lib/ai/voice";

/**
 * Speaks a sample line in a chosen voice, so a parent can hear it before setting it on a
 * child. Choosing a teacher's voice from a dropdown of names is guesswork otherwise.
 */
export const maxDuration = 30;

const SAMPLE =
  "Hello! I'm your teacher. Today we're going to look at fractions — and I promise it's easier than it looks.";

export async function POST(req: Request) {
  try {
    await requireParentApi(req);
    const { voiceId, text } = z
      .object({ voiceId: z.string().min(1), text: z.string().max(300).optional() })
      .parse(await req.json());

    const { audio, contentType } = await speak(text?.trim() || SAMPLE, voiceId);
    return new Response(audio, {
      headers: { "content-type": contentType, "content-length": String(audio.byteLength) },
    });
  } catch (err) {
    if (err instanceof VoiceUnavailable) return Response.json({ error: err.message }, { status: 503 });
    if (err instanceof z.ZodError) return Response.json({ error: "Pick a voice first." }, { status: 400 });
    return jsonError(err);
  }
}
