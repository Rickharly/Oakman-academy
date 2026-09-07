/**
 * Liveness probe for the platform's health check.
 *
 * Deliberately does not touch the database: this answers "is the server up and serving?",
 * which is what a deploy health check needs to decide whether to route traffic. Reporting
 * unhealthy because a query was slow would take a working site offline.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "family-school", time: new Date().toISOString() });
}
