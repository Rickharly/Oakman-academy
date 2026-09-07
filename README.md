# Oakman Academy

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

### Locked out? (wrong email or password at `/login`)

An account created on an earlier deploy keeps the credentials it was created with — a password
you change in the app is never reverted by the next deploy. So if the first boot ran before your
variables were set, the parent still exists under the old address and password.

To move it to the configured values, set on the web service:

```
SEED_RESET_CREDENTIALS = true
```

Redeploy, log in, then **delete that variable** so it doesn't reset your password again. It also
resets the students' PINs to Eva `1234` and Mikhael `5678`. The deploy log prints the address the
parent account ended up on.

### First things to do after deploying

- Log in as the parent, open **Settings**, change both children's PINs.
- Still in **Settings**, add a photo for each child ("Add photo"). It is cropped square and
  shrunk in the browser, then stored in the database — so it survives redeploys, unlike a file
  written to the container. Without a photo they keep an emoji.
- Open **Schedule**, check the weekly subject frequencies and daily minutes for each child.
- Do one lesson yourself as a student, then open it in **Admin** to see the full record.

### Switching to the real Oak curriculum

Once your Oak API key arrives:

```
OAK_API_KEY=...            # set on the Railway service
CURRICULUM_PROVIDER=oak
```

then run:

```
pnpm oak:sync --switch
```

That imports every subject for each child's year group and then moves them onto it — new
enrolments, and their weekly schedule repointed at the Oak subjects. Without `--switch` the
curriculum is imported but the children keep studying the bundled lessons, because their
enrolments still point there.

Useful variants:

| Command | What it does |
|---|---|
| `pnpm oak:sync` | import only, leave the children where they are |
| `pnpm oak:sync --year 7` | just one year group |
| `pnpm oak:sync --subject maths --year 7` | one subject |
| `pnpm oak:sync --assets` | also download worksheets and slide decks |
| `pnpm oak:sync --switch-only` | move the children over without re-importing |

Existing learning history is untouched: curriculum and student data are separate, the old
enrolments are archived rather than deleted, and every lesson already completed keeps its
answers, marks and mastery in Admin.

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
your `.env`, and the students `eva` (PIN `1234`) and `mikhael` (PIN `5678`).

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
