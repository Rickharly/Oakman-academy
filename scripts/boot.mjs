/**
 * The production boot sequence: migrate, seed, serve.
 *
 * The rule here is that **the school always comes up**. A migration that fails used to stop
 * the chain, which meant the family saw nothing at all — no page, no error, just a host that
 * would not answer. A dead app tells you nothing at four in the afternoon with two children
 * waiting; an app that loads and says exactly what is wrong tells you everything.
 *
 * So: every step is attempted, failures are recorded rather than thrown, and the server starts
 * regardless. `/api/health` then reports what did not work, and the pages that need the missing
 * schema will error individually instead of taking the whole site down.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STATUS_FILE = path.join(process.cwd(), ".boot-status.json");
const status = { migratedAt: null, migrationError: null, releaseError: null };

function record() {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {
    // The status file is a convenience; never let it stop the boot.
  }
}

function attempt(label, command, args) {
  try {
    execFileSync(command, args, { stdio: "inherit", env: process.env });
    return null;
  } catch (err) {
    const message = err?.stderr?.toString?.() || err?.message || String(err);
    console.error(`\n[boot] ${label} FAILED.\n${message}\n`);
    return message.slice(0, 2000);
  }
}

// ── 1. Schema ──────────────────────────────────────────────────────────────
console.log("[boot] applying database migrations…");
status.migrationError = attempt("migrate deploy", "npx", ["prisma", "migrate", "deploy"]);

if (status.migrationError) {
  console.error(
    [
      "[boot] ────────────────────────────────────────────────────────────",
      "[boot] The database schema is NOT up to date. The app will still start,",
      "[boot] but anything needing the new tables will fail until this is fixed.",
      "[boot]",
      "[boot] Most common causes:",
      "[boot]  • P3009 — an earlier migration failed and is blocking the rest.",
      "[boot]    Fix: `npx prisma migrate resolve --rolled-back <migration_name>`",
      "[boot]    then redeploy.",
      "[boot]  • The database was created with `db push` and has no migration",
      "[boot]    history. Fix: `npx prisma migrate resolve --applied <name>` for",
      "[boot]    each migration already reflected in the schema.",
      "[boot]  • DATABASE_URL points somewhere unexpected, or the database is",
      "[boot]    asleep or out of connections.",
      "[boot] ────────────────────────────────────────────────────────────",
    ].join("\n"),
  );
} else {
  status.migratedAt = new Date().toISOString();
}

// ── 2. Seed and optional curriculum import ─────────────────────────────────
status.releaseError = attempt("release tasks", "node", ["scripts/release.mjs"]);

record();

// ── 3. Serve, whatever happened above ──────────────────────────────────────
console.log("[boot] starting the server…");
const server = spawn("npx", ["next", "start"], { stdio: "inherit", env: process.env });
server.on("exit", (code) => process.exit(code ?? 0));
