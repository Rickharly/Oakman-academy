/**
 * Liveness probe for the platform's health check, and the first place to look when something
 * is wrong with a deploy.
 *
 * `ok` stays true whenever the server is serving, because that is what a deploy health check
 * needs to decide whether to route traffic — reporting unhealthy because a query was slow
 * would take a working site offline. What did go wrong on boot is reported alongside it, so a
 * half-deployed app can say so instead of leaving you guessing.
 */
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

type BootStatus = {
  migratedAt: string | null;
  migrationError: string | null;
  releaseError: string | null;
};

function readBootStatus(): BootStatus | null {
  try {
    const file = path.join(process.cwd(), ".boot-status.json");
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as BootStatus;
  } catch {
    return null;
  }
}

export function GET() {
  const boot = readBootStatus();
  const problems: string[] = [];
  if (boot?.migrationError) {
    problems.push(
      "Database migrations did not apply. Pages needing the newest tables will fail. " +
        "See the deploy logs for the exact error and the suggested fix.",
    );
  }
  if (boot?.releaseError) {
    problems.push("Seeding or the curriculum import failed. Existing data is untouched.");
  }

  return Response.json({
    ok: true,
    service: "oakman-academy",
    time: new Date().toISOString(),
    schemaUpToDate: boot ? boot.migrationError === null : null,
    migratedAt: boot?.migratedAt ?? null,
    problems,
  });
}
