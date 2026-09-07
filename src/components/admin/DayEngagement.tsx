import { Clock, Coffee, Timer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { DayEngagement as DayEngagementData } from "@/lib/engagement/service";

const BREAK_LABEL: Record<string, string> = {
  TOILET: "Toilet",
  DRINK: "Drink or snack",
  CALLED_AWAY: "Called away",
  OTHER: "Something else",
  IDLE: "Idle",
};

function lateness(minutes: number | null): { text: string; tone: string } {
  if (minutes === null) return { text: "Not started yet", tone: "text-ink-muted" };
  if (minutes <= 0) return { text: `On time${minutes < -1 ? ` (${Math.abs(minutes)} min early)` : ""}`, tone: "text-success" };
  if (minutes <= 10) return { text: `${minutes} min late`, tone: "text-ink" };
  return { text: `${minutes} min late`, tone: "text-warning" };
}

/**
 * How the day actually went, for a parent.
 *
 * Deliberately plain numbers rather than a score out of ten. Focus is a weak proxy — a child
 * can look busy and learn nothing, or sit still and think hard — so it is shown next to the
 * work itself, never instead of it.
 */
export function DayEngagement({ day }: { day: DayEngagementData }) {
  const start = lateness(day.startedLateMinutes);
  const focusPct = day.focusRatio === null ? null : Math.round(day.focusRatio * 100);

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Timer className="h-4 w-4 text-ink-muted" /> How the day went
      </h2>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Started</dt>
          <dd className={`text-sm font-semibold ${start.tone}`}>{start.text}</dd>
          {day.plannedStartTime ? (
            <dd className="text-xs text-ink-faint">Planned {day.plannedStartTime}</dd>
          ) : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Working</dt>
          <dd className="text-sm font-semibold text-ink">{day.activeMinutes} min</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Idle</dt>
          <dd className="text-sm font-semibold text-ink">{day.idleMinutes} min</dd>
          <dd className="text-xs text-ink-faint">No reason given</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Focus</dt>
          <dd className="text-sm font-semibold text-ink">{focusPct === null ? "—" : `${focusPct}%`}</dd>
          <dd className="text-xs text-ink-faint">Of time at the screen</dd>
        </div>
      </dl>

      {day.lateStarts.length > 0 ? (
        <div className="rounded-2xl bg-warning-soft p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
            <Clock className="h-3.5 w-3.5" /> Started late
          </p>
          <ul className="mt-1 space-y-0.5">
            {day.lateStarts.map((l) => (
              <li key={l.title} className="text-sm text-ink">
                {l.title} — {l.lateMinutes} min after it was due
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {day.breaks.length > 0 ? (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Coffee className="h-3.5 w-3.5" /> Breaks they flagged ({day.awayMinutes} min)
          </p>
          <ul className="mt-1 space-y-0.5">
            {day.breaks.map((b, i) => (
              <li key={i} className="text-sm text-ink-muted">
                {BREAK_LABEL[b.kind] ?? b.kind} — {b.minutes} min
                {b.note ? ` · ${b.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
