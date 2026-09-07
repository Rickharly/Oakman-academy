import { z } from "zod";
import { requireStudentApi, jsonError } from "@/lib/auth/api";
import { endFocusEvent, startFocusEvent } from "@/lib/engagement/service";
import { FocusEventKind } from "@/generated/prisma/client";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    kind: z.enum([
      FocusEventKind.TOILET,
      FocusEventKind.DRINK,
      FocusEventKind.CALLED_AWAY,
      FocusEventKind.OTHER,
    ]),
    note: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal("end"), eventId: z.string().optional() }),
]);

/** "I need a moment" / "I'm back". Records why a gap happened so it is not read as drifting off. */
export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await requireStudentApi(req);
    const { attemptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const studentId = user.studentProfile.id;

    if (body.action === "start") {
      const event = await startFocusEvent(studentId, { attemptId, kind: body.kind, note: body.note });
      return Response.json({ eventId: event.id });
    }

    const seconds = await endFocusEvent(studentId, body.eventId);
    return Response.json({ seconds });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Unrecognised request" }, { status: 400 });
    }
    return jsonError(err);
  }
}
