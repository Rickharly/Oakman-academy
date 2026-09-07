import { z } from "zod";
import { requireParentApi, jsonError } from "@/lib/auth/api";
import { getCurriculumProvider } from "@/lib/curriculum/provider";
import { syncMany, syncProgramme, type SyncScope } from "@/lib/curriculum/sync";

const bodySchema = z.object({
  subjectSlug: z.string().optional(),
  yearGroup: z.number().int().optional(),
  all: z.boolean().optional(),
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
      const { jobIds } = await syncMany(scopes);
      return Response.json({ jobIds });
    }

    if (!body.subjectSlug || body.yearGroup == null) {
      return Response.json({ error: "subjectSlug and yearGroup are required unless all=true" }, { status: 400 });
    }

    const { jobId } = await syncProgramme({ subjectSlug: body.subjectSlug, yearGroup: body.yearGroup });
    return Response.json({ jobId });
  } catch (err) {
    return jsonError(err);
  }
}
