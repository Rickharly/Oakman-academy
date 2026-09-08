/**
 * Runs once per server process, before the server accepts requests.
 *
 * Nothing in here may throw and nothing may block: `register` must finish before the app is
 * ready to serve, so a mistake here does not degrade the app — it stops it starting. Children
 * have waited on that before.
 */
export async function register() {
  // Edge and browser runtimes have no database and no business scheduling imports.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { startWeeklyImportScheduler } = await import("@/lib/curriculum/weekly");
    startWeeklyImportScheduler();
  } catch (err) {
    // A scheduler that will not start is a missed import. A server that will not start is a
    // school that is shut. Log it and carry on.
    console.error("[instrumentation] weekly import scheduler did not start", err);
  }
}
