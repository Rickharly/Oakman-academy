import { prisma } from "@/lib/db";
import { requireParentApi, jsonError, ApiError } from "@/lib/auth/api";

export async function GET(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    await requireParentApi(req);
    const { jobId } = await ctx.params;

    const job = await prisma.curriculumSyncJob.findUnique({ where: { id: jobId } });
    if (!job) throw new ApiError(404, "Sync job not found");

    return Response.json({ job });
  } catch (err) {
    return jsonError(err);
  }
}
