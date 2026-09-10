import { z } from "zod";
import { createHash } from "node:crypto";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { speak, DEFAULT_VOICE_ID, VoiceUnavailable } from "@/lib/ai/voice";
import { spokenMaths } from "@/lib/text/maths";

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
    /**
     * Said the way a teacher says it.
     *
     * A voice given `$$\frac{3}{4}$$` says "dollar dollar frac three four", which is worse than
     * silence — and this is the button a child leans on when the reading is hard. Symbols
     * become words first: three quarters, times, the square root of.
     */
    const { audio, contentType } = await speak(spokenMaths(text), voiceId);

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
