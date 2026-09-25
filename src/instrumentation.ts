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

  try {
    // One-off, idempotent repair for ORDERING/MATCHING questions imported before the mapper
    // started shuffling their displayed order — see repairPresolvedQuestions() in sync.ts.
    // Runs once per server process; a row already fixed (or never broken) costs a no-op update
    // check and nothing more, so there is no reason to gate this behind an env var the way the
    // weekly import is.
    const { repairPresolvedQuestions } = await import("@/lib/curriculum/sync");
    const repaired = await repairPresolvedQuestions();
    if (repaired.ordering || repaired.matching) {
      console.log(
        `[instrumentation] repaired ${repaired.ordering} ordering and ${repaired.matching} ` +
          `matching question(s) that were still pre-solved`,
      );
    }
  } catch (err) {
    // Same rule as everything else in here: a repair that cannot run is a data-quality miss,
    // not a reason the school does not open today.
    console.error("[instrumentation] repair of pre-solved questions failed", err);
  }
}
