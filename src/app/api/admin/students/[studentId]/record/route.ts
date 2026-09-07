import { jsonError } from "@/lib/auth/api";
import { requireParentOfStudent } from "@/lib/auth/session";
import { buildAcademicRecord, saveAcademicRecord } from "@/lib/records/academic-record";

/** Builds the record with the teacher's notes and saves it as issued. */
export async function POST(_req: Request, ctx: { params: Promise<{ studentId: string }> }) {
  try {
    const { studentId } = await ctx.params;
    await requireParentOfStudent(studentId);

    const record = await buildAcademicRecord(studentId, { withNotes: true });
    const saved = await saveAcademicRecord(studentId, record);

    return Response.json({ reportId: saved.id });
  } catch (err) {
    return jsonError(err);
  }
}
