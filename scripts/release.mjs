/**
 * Runs on every deploy, after `prisma migrate deploy`, before the server starts.
 *
 * Seeds the parent + student accounts and the bundled curriculum the first time only.
 * Safe to run repeatedly: the seed is idempotent, and it is skipped entirely once
 * students exist unless SEED_ON_DEPLOY=always.
 */
import { execFileSync } from "node:child_process";

const mode = process.env.SEED_ON_DEPLOY ?? "if-empty";
if (mode === "never") {
  console.log("[release] SEED_ON_DEPLOY=never — skipping seed.");
  process.exit(0);
}

try {
  execFileSync("node", ["--import", "tsx", "scripts/seed.ts"], {
    stdio: "inherit",
    env: { ...process.env, SEED_MODE: mode },
  });
} catch (err) {
  console.error("[release] Seed failed. The app will still start; run `pnpm db:seed` manually.", err?.message ?? err);
}
