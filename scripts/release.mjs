/**
 * Runs on every deploy, after `prisma migrate deploy`, before the server starts.
 *
 * Two optional steps, both driven by environment variables so a deploy is the only thing you
 * ever have to trigger by hand:
 *
 *   SEED_ON_DEPLOY   if-empty (default) | always | never
 *   OAK_SYNC_ON_DEPLOY  off (default) | import | switch
 *   OAK_LESSONS_PER_DEPLOY  how many lessons one deploy may import (default 10)
 *
 * `switch` imports the Oak curriculum and moves the students onto it — the one-off step when
 * an Oak API key first arrives. It is safe to leave set: the import is idempotent, already
 * imported lessons are skipped, and each deploy imports only a small batch.
 *
 * That batch limit is not a nicety. Oak's quota is a fixed budget per window and a lesson
 * costs several requests, so an unbounded import on every deploy will empty the quota — and a
 * day of ordinary deploys then leaves a family unable to import anything at all.
 *
 * Neither step is allowed to stop the server from starting: a school that boots with stale
 * curriculum is far better than one that will not boot at all.
 */
import { execFileSync } from "node:child_process";

function run(label, args, env = {}) {
  try {
    execFileSync("node", ["--import", "tsx", ...args], {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    return true;
  } catch (err) {
    console.error(`[release] ${label} failed — the app will still start. ${err?.message ?? err}`);
    return false;
  }
}

const seedMode = process.env.SEED_ON_DEPLOY ?? "if-empty";
if (seedMode === "never") {
  console.log("[release] SEED_ON_DEPLOY=never — skipping the seed.");
} else {
  run("seed", ["scripts/seed.ts"], { SEED_MODE: seedMode });
}

const oakMode = (process.env.OAK_SYNC_ON_DEPLOY ?? "off").toLowerCase();
if (oakMode === "off") {
  console.log("[release] OAK_SYNC_ON_DEPLOY=off — not importing from Oak.");
} else if (!process.env.OAK_API_KEY) {
  console.warn("[release] OAK_SYNC_ON_DEPLOY is set but OAK_API_KEY is missing — skipping the Oak import.");
} else {
  const perDeploy = process.env.OAK_LESSONS_PER_DEPLOY ?? "10";
  const args = ["scripts/oak-sync.ts", "--max-lessons", perDeploy];
  if (oakMode === "switch") args.push("--switch");
  console.log(`[release] importing up to ${perDeploy} lesson(s) from Oak (${oakMode})…`);
  run("Oak sync", args);
}
