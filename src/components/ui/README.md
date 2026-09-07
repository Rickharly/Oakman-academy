# UI primitives

Design tokens live in `src/app/globals.css` (`@theme`): `surface`, `surface-raised`, `ink`,
`ink-muted`, `ink-faint`, `line`, `line-strong`, `accent` (+`-hover`/`-soft`/`-ink`), `success`,
`warning`, `danger` (each +`-soft`), and `subject-{maths,english,science,history,geography}`
(+`-soft`). Use them as Tailwind utilities: `bg-surface`, `text-ink-muted`, `border-line`,
`bg-subject-maths-soft text-subject-maths`. `cn()` from `@/lib/cn` joins class strings.

- **Button** `{ variant: "primary"|"secondary"|"ghost"|"danger", size: "md"|"lg", href?, ...restProps }`
  — pass `href` to render a styled `next/link`, otherwise a `<button>`. Other props pass through.
  `<Button variant="secondary" href="/subjects">Browse</Button>`
- **Card** `{ hover?, padding: "none"|"sm"|"md"|"lg", ...divProps }` — white rounded-2xl surface.
  `<Card hover padding="lg">…</Card>`
- **Badge** `{ status?: "not-started"|"in-progress"|"completed"|"needs-review"|"mastered", tone?, children? }`
  — pass `status` for a canonical chip, or `tone` + custom children.
- **ProgressRing** `{ value: 0-100, size?, strokeWidth?, label? }` — SVG ring, e.g. for mastery %.
- **ProgressBar** `{ value: 0-100, size?: "sm"|"md" }` — horizontal bar.
- **Input** / **Textarea** — styled `<input>`/`<textarea>`, all native props pass through.
- **Sheet** `{ open, onClose, side?: "bottom"|"right", title? }` (client) — controlled bottom
  sheet (mobile) or side panel (desktop). Render it always; toggle `open` from parent state.
- **Tabs** `{ items: {value,label,disabled?}[], value?, defaultValue?, onChange? }` (client) —
  controlled if `value`+`onChange` given, else manages its own state.
- **EmptyState** `{ title, description?, icon?: LucideIcon, action? }` — centred placeholder.
- **PageHeader** `{ title, description?, actions? }` — page title row.
- **Avatar** `{ emoji, size?: "sm"|"md"|"lg" }` — emoji in a soft accent circle.
- **Stat** `{ label, value, delta?, deltaTone?: "positive"|"negative"|"neutral" }`.
- **Skeleton** `{ className }` — pulsing placeholder block; size it with `className` (e.g. `h-4 w-24`).
- **Kbd** — small keyboard-shortcut chip.

All components are typed and accept `className` for one-off overrides. Only `Sheet` and `Tabs`
are client components; everything else is safe in server components. Import each from
`@/components/ui/<Name>` (no barrel file, to keep server/client boundaries explicit).
