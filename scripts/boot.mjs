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

/**
 * Finds the JavaScript entry point of an installed tool, to be run with this very node binary.
 *
 * Deliberately not `npx`, and deliberately not `node_modules/.bin`. npx will try to *download*
 * a package it cannot find, which on a container hangs until the platform gives up and reports
 * the app as unable to respond. The `.bin` entries are shell shims that `exec node`, so they
 * need node on PATH — which is one more thing that can differ between a laptop and a container.
 *
 * `process.execPath` is the node already running this file. It cannot be missing.
 */
function entryPoint(candidates) {
  for (const relative of candidates) {
    const full = path.join(process.cwd(), "node_modules", relative);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const PRISMA = entryPoint(["prisma/build/index.js"]);
const NEXT = entryPoint(["next/dist/bin/next"]);

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
status.migrationError = PRISMA
  ? attempt("migrate deploy", process.execPath, [PRISMA, "migrate", "deploy"])
  : "prisma is not installed — cannot apply migrations.";

if (status.migrationError) {
  console.error(
    [
      "[boot] ────────────────────────────────────────────────────────────",
      "[boot] The database schema is NOT up to date. The app will still start,",
      "[boot] but anything needing the new tables will fail until this is fixed.",
      "[boot]",
      "[boot] Most common causes:",
      "[boot]  • P3009 — an earlier migration failed and is blocking the rest.",
      "[boot]    Fix: `pnpm prisma migrate resolve --rolled-back <migration_name>`",
      "[boot]    then redeploy.",
      "[boot]  • The database was created with `db push` and has no migration",
      "[boot]    history. Fix: `pnpm prisma migrate resolve --applied <name>` for",
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
if (!NEXT) {
  console.error("[boot] FATAL: next is not installed. Nothing can be served.");
  process.exit(1);
}

const server = spawn(process.execPath, [NEXT, "start"], { stdio: "inherit", env: process.env });
server.on("exit", (code) => process.exit(code ?? 0));
// A crash in the server must take the process down so the platform restarts it, rather than
// leaving a live container with nothing listening on the port.
server.on("error", (err) => {
  console.error("[boot] FATAL: could not start the server.", err);
  process.exit(1);
});
