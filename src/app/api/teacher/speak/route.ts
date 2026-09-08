import { z } from "zod";
import { createHash } from "node:crypto";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { speak, DEFAULT_VOICE_ID, VoiceUnavailable } from "@/lib/ai/voice";

/**
 * Reads a piece of the teacher's text aloud, in this child's own voice.
 *
 * The voice is taken from the child's profile rather than the request, so a page cannot ask
 * for someone else's. A failure returns a plain error the page can ignore — the words are
 * already on screen, so a voice that will not play should never block a lesson.
 */
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireStudentApi(req);
    const { text } = z.object({ text: z.string().min(1).max(2500) }).parse(await req.json());

    const voiceId = user.studentProfile.voiceId ?? DEFAULT_VOICE_ID;
    const { audio, contentType } = await speak(text, voiceId);

    return new Response(audio, {
      headers: {
        "content-type": contentType,
        "content-length": String(audio.byteLength),
        // Same words, same voice, same audio: safe to reuse for the length of a lesson.
        "cache-control": "private, max-age=3600",
        etag: `"${createHash("sha1").update(`${voiceId}:${text}`).digest("hex").slice(0, 16)}"`,
      },
    });
  } catch (err) {
    if (err instanceof VoiceUnavailable) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Nothing to read aloud." }, { status: 400 });
    }
    return jsonError(err);
  }
}
