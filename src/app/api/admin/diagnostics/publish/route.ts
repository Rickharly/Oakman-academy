/**
 * POST /api/admin/diagnostics/publish — send the current state to where it can be read.
 *
 * Parent-only. Runs the checks and posts them to the repository's diagnostics issue.
 */
import { z } from "zod";
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { publishDiagnostics } from "@/lib/admin/report-to-github";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    await requireParentApi(req);
    const body = await req
      .json()
      .then((v) => z.object({ note: z.string().max(2000).optional() }).parse(v))
      .catch(() => ({ note: undefined }));

    const result = await publishDiagnostics(body.note);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    return jsonError(err);
  }
}
