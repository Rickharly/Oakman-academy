# Family School — engineering conventions

Read `docs/ARCHITECTURE.md` first; `prisma/schema.prisma` is the data contract.

## Stack (exact versions matter)

- **Next.js 16.3 App Router**, React 19, TypeScript strict. This is NOT the Next.js you
  remember: `params`/`searchParams` are **Promises** (`const { id } = await params`),
  `cookies()`/`headers()` are async, the request-time file is `src/proxy.ts` (not middleware.ts).
  Docs: `node_modules/next/dist/docs/01-app/`.
- **Prisma 7.10** with `@prisma/adapter-pg`. Import the client from `@/lib/db` (`prisma`) and
  types/enums from `@/generated/prisma/client` (e.g. `import { LessonStage } from "@/generated/prisma/client"`).
  Enums are plain string unions at runtime; use the exported enum objects for values.
  Config in `prisma.config.ts`. Migrations: `pnpm prisma migrate dev --name <name>`.
- **Tailwind v4** (CSS-first; theme tokens in `src/app/globals.css` via `@theme`). No component library.
- **zod 4**, **openai** SDK (Responses API + structured outputs), **date-fns**, **lucide-react**.
- **Vitest** for unit/integration tests (`pnpm test`), real Postgres, `AI_PROVIDER=mock`.

## Rules

1. Never write to curriculum tables outside `src/lib/curriculum/sync.ts` (exceptions in ARCHITECTURE §1).
2. Never delete or overwrite learning history. Corrections are new rows (`ParentOverride`, new attempts).
3. Every page/route/action authenticates with `requireParent()` / `requireStudent()` / `requireUser()`
   and scopes queries by the authenticated student. Parents may only access students linked to them.
4. Question data uses the canonical shapes in `src/lib/questions/types.ts`. Validate with zod at the boundary.
5. AI calls go through `src/lib/ai/provider.ts`; software-consumed results use structured outputs (zod schemas).
   `TeacherMode` is computed on the server from the lesson stage, never sent by the client.
6. Server components by default; `"use client"` only for interactive leaves. Keep client components small.
7. Mutations from client components use route handlers under `src/app/api` (JSON in/out) or server actions.
8. Design: light, calm, spacious, rounded (`rounded-2xl`), restrained borders (`border-stone-200`),
   near-white background, strong typography, no cartoon mascots, touch targets ≥ 44px, iPad first.
9. Dates: store `DateTime @db.Date` values as UTC midnight (`toDateOnly()` in `src/lib/dates.ts`); the
   school day is computed in the family's timezone (`SCHOOL_TIMEZONE`, default `Europe/London`).
10. Tests: put unit tests next to code (`*.test.ts`); DB-backed tests in `tests/`. Run `pnpm typecheck`,
    `pnpm lint`, and `pnpm test` before declaring work done.

## Commands

```
pnpm dev             # next dev
pnpm build           # next build
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm test            # vitest run
pnpm db:migrate      # prisma migrate dev
pnpm db:seed         # seed parent + students + fixture curriculum + schedules
pnpm oak:sync        # sync curriculum from Oak (needs OAK_API_KEY)
pnpm oak:types       # regenerate src/lib/oak/openapi.d.ts from vendor/oak/openapi.json
pnpm plan            # plan today's assignments for every student
```
