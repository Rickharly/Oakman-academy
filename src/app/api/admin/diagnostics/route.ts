/**
 * GET /api/admin/diagnostics — what is actually broken, from inside the server.
 *
 * Parent-only: it reports which credentials are configured and calls paid services.
 */
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { runDiagnostics } from "@/lib/admin/diagnostics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    await requireParentApi(req);
    return Response.json({ checks: await runDiagnostics(), at: new Date().toISOString() });
  } catch (err) {
    return jsonError(err);
  }
}
