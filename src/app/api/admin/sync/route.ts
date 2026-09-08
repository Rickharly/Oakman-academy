import { z } from "zod";
import { requireParentApi, jsonError } from "@/lib/auth/api";
import { getCurriculumProvider } from "@/lib/curriculum/provider";
import { syncMany, syncProgramme, type SyncScope } from "@/lib/curriculum/sync";

const bodySchema = z.object({
  subjectSlug: z.string().optional(),
  yearGroup: z.number().int().optional(),
  all: z.boolean().optional(),
  /**
   * How many lessons to import in this run. Oak's quota is a fixed budget per window, so
   * importing in batches is what makes an import finish at all. Defaults to a batch that
   * comfortably fits alongside the other subjects.
   */
  maxLessons: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  try {
    await requireParentApi(req);
    const body = bodySchema.parse(await req.json());

    if (body.all) {
      const provider = getCurriculumProvider();
      const subjects = await provider.getSubjects();
      const scopes: SyncScope[] = [];
      for (const subject of subjects) {
        const programmes = await provider.getProgrammes(subject.slug);
        for (const programme of programmes) {
          scopes.push({ subjectSlug: subject.slug, yearGroup: programme.yearGroup });
        }
      }
      const { jobIds } = await syncMany(scopes, { maxLessons: body.maxLessons ?? 10 });
      return Response.json({ jobIds });
    }

    if (!body.subjectSlug || body.yearGroup == null) {
      return Response.json({ error: "subjectSlug and yearGroup are required unless all=true" }, { status: 400 });
    }

    const { jobId } = await syncProgramme(
      { subjectSlug: body.subjectSlug, yearGroup: body.yearGroup },
      { maxLessons: body.maxLessons ?? 25 },
    );
    return Response.json({ jobId });
  } catch (err) {
    return jsonError(err);
  }
}
