/**
 * GET /api/ops/diagnostics — the parent's diagnostics report, read-only, for the maintainer.
 *
 * Bearer-token only (see `ops-token.ts`), enabled by the parent setting `OPS_READ_TOKEN` on the
 * host. Outside the login redirect in `proxy.ts` because it carries no session cookie. Answers
 * 404 when the token is missing or wrong, so the route does not advertise itself.
 */
import { hasOpsReadToken } from "@/lib/auth/ops-token";
import { runDiagnostics } from "@/lib/admin/diagnostics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!hasOpsReadToken(req)) return new Response("Not found", { status: 404 });
  return Response.json({ checks: await runDiagnostics(), at: new Date().toISOString() });
}
