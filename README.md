# Family School

The children's day-to-day school interface. They log in and see today's lessons; they learn,
answer questions, ask the teacher, take the quiz and finish, all in one place. The parent sees
everything: every answer, every mark, every conversation, and can override any of it.

Curriculum comes from [Oak National Academy's open API](https://open-api.thenational.academy/)
when a key is configured, and from a bundled sample curriculum otherwise.

> **Status:** in active development on `claude/family-school-build-hta2ee`. `main` carries the
> latest reviewed state so it can be deployed. Check the pull request for what has landed.

## Deploying on Railway

1. **New project** → *Deploy from GitHub repo* → this repository, branch `main`.
2. **Add Postgres**: *+ New* → *Database* → *PostgreSQL*. Railway injects `DATABASE_URL`
   into the service automatically. If it does not, add a variable
   `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the web service.
3. **Set variables** on the web service. Railway does **not** share the database plugin's
   variables with other services automatically, so `DATABASE_URL` has to be referenced
   explicitly — this is the single most common reason a deploy crashloops:

   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```

   (replace `Postgres` with the exact name of your database service). Then the rest:

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | any long random string (e.g. `openssl rand -hex 32`) |
   | `OPENAI_API_KEY` | your OpenAI key |
   | `AI_PROVIDER` | `openai` (use `mock` to run with no AI cost) |
   | `CURRICULUM_PROVIDER` | `fixture` until your Oak key arrives, then `oak` |
   | `OAK_API_KEY` | your Oak key, once you have it |
   | `SEED_PARENT_EMAIL` | the email you will log in with |
   | `SEED_PARENT_PASSWORD` | your initial password (change it after first login) |
   | `SCHOOL_TIMEZONE` | e.g. `Europe/London` |

4. **Deploy.** The start command runs `prisma migrate deploy`, then seeds the parent account,
   the two student accounts and the bundled curriculum on first boot, then starts the server.
   Re-deploys do not re-seed (set `SEED_ON_DEPLOY=never` to be certain, or `always` to force).
5. **Generate a domain** under *Settings → Networking*, open it, and log in with the parent
   email and password you set.

### First things to do after deploying

- Log in as the parent, open **Settings**, change both children's PINs.
- Open **Schedule**, check the weekly subject frequencies and daily minutes for each child.
- Do one lesson yourself as a student, then open it in **Admin** to see the full record.

### Switching to the real Oak curriculum

Once your Oak API key arrives:

```
OAK_API_KEY=...            # set on the Railway service
CURRICULUM_PROVIDER=oak
```

then run the sync from the **Admin → Curriculum** page (*Sync now*), or locally with
`pnpm oak:sync --all-for-year 7 && pnpm oak:sync --all-for-year 5`.
Existing learning history is untouched: curriculum and student data are separate.

## Running locally

Requires Node 22+, pnpm, and a PostgreSQL 16 database.

```bash
pnpm install
cp .env.example .env          # then edit DATABASE_URL and the keys
pnpm db:migrate               # create the schema
pnpm db:seed                  # parent + students + bundled curriculum + schedules
pnpm dev                      # http://localhost:3000
```

Seeded accounts (change these immediately in production): the parent email and password from
your `.env`, and the two students with the usernames and PINs printed by the seed.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | development server |
| `pnpm build` / `pnpm start` | production build and server |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | checks |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | database |
| `pnpm oak:sync` | import curriculum from Oak (needs `OAK_API_KEY`) |
| `pnpm oak:types` | regenerate Oak API types from the vendored spec |
| `pnpm plan` | plan today's assignments for every student |
| `pnpm e2e` | Playwright end-to-end run |

## How it fits together

- `docs/SPEC.md` — the product specification.
- `docs/ARCHITECTURE.md` — layers, route map, lesson flow, grading, AI, scheduling, Oak plan.
- `docs/CONTRACTS.md` — the interface each module implements.
- `prisma/schema.prisma` — the data model. Curriculum tables are reference data; learning tables
  are append-only history. Nothing educational is ever deleted; parent corrections are new rows.

## Costs

Deterministic question types (multiple choice, numeric, matching, ordering, true/false) are marked
in code, not by the model. Only written answers and the tutor chat use OpenAI, with a small fast
model by default and a stronger one only for extended writing. Conversations are summarised rather
than resent in full.
