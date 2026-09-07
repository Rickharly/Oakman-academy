// Prisma CLI configuration. The connection string is resolved the same way the app resolves
// it (see src/lib/database-url.ts) so `prisma migrate deploy` and the running server can never
// disagree about which database they are talking to.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl, MISSING_DATABASE_URL_MESSAGE } from "./src/lib/database-url";

const url = resolveDatabaseUrl();
if (!url) {
  console.error(`\n${MISSING_DATABASE_URL_MESSAGE}\n`);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: url ?? "",
  },
});
