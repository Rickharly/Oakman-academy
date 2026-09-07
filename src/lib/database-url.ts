/**
 * Resolves the Postgres connection string from the environment.
 *
 * Deliberately dependency-free and free of path aliases: `prisma.config.ts` imports this by
 * relative path, and it runs under the Prisma CLI's own loader.
 *
 * Hosts expose the database under different names. Railway's Postgres plugin publishes
 * `DATABASE_URL` on the *database* service, and only shares it with the web service if you add
 * a reference variable; several of its templates instead expose `DATABASE_PUBLIC_URL` or the
 * discrete `PG*` variables. Accepting all of them means a correctly provisioned database works
 * without the deploy hinging on one variable being wired by hand.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct =
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.DATABASE_PRIVATE_URL ||
    env.DATABASE_PUBLIC_URL;
  if (direct) return direct;

  // Compose from the discrete libpq variables when no full URL is present.
  const host = env.PGHOST;
  const user = env.PGUSER;
  const password = env.PGPASSWORD;
  const database = env.PGDATABASE;
  const port = env.PGPORT || "5432";
  if (host && user && database) {
    const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
    return `postgresql://${auth}@${host}:${port}/${database}`;
  }

  return undefined;
}

/** The message shown when no database can be found — it has to tell you exactly what to do. */
export const MISSING_DATABASE_URL_MESSAGE = [
  "No database connection string found.",
  "",
  "Set DATABASE_URL on the web service. On Railway the Postgres plugin does not share its",
  "variables automatically: open the web service → Variables → New Variable, and set",
  "  DATABASE_URL = ${{Postgres.DATABASE_URL}}",
  "(replace `Postgres` with the exact name of your database service).",
  "",
  "PGHOST/PGUSER/PGPASSWORD/PGDATABASE are also accepted if you prefer to reference those.",
].join("\n");
