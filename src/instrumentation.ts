/**
 * Runs once per server process, before the server accepts requests.
 *
 * Keep it non-blocking: `register` must finish before the app is ready, so anything slow gets
 * started here and awaited nowhere.
 */
export async function register() {
  // Edge and browser runtimes have no database and no business scheduling imports.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startWeeklyImportScheduler } = await import("@/lib/curriculum/weekly");
  startWeeklyImportScheduler();
}
