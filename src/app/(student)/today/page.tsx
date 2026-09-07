import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { SCHOOL_TIMEZONE, isoWeekday, schoolDayKey } from "@/lib/dates";
import { ensureDayPlanned, getTodayView } from "@/lib/scheduling/planner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";
import { firstName, formatDateWords, formatMinutes, greetingForHour } from "@/components/student/format";
import { WelcomeOverlay } from "@/components/student/WelcomeOverlay";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await requireStudent();
  const { welcome } = await searchParams;
  const profileId = user.studentProfile.id;
  const dateKey = schoolDayKey();

  const hour = Number(formatInTimeZone(new Date(), SCHOOL_TIMEZONE, "H"));
  const greeting = `${greetingForHour(hour)}, ${firstName(user.displayName)}.`;

  const isWeekend = isoWeekday(dateKey) > 5;

  await ensureDayPlanned(profileId, dateKey);
  const view = await getTodayView(profileId, dateKey);
  const cards = view.assignments.filter((a) => a.status !== "MOVED");

  // Shown once, the first time a child ever opens the school. `?welcome=1` replays it so a
  // parent can walk them through it again without touching the database.
  const preferences = (user.studentProfile.preferences ?? {}) as Record<string, unknown>;
  const preview = welcome === "1";
  const showWelcome = preview || !preferences.welcomeSeenAt;

  return (
    <div className="space-y-8">
      {showWelcome ? (
        <WelcomeOverlay
          firstName={firstName(user.displayName)}
          yearGroup={user.studentProfile.yearGroup}
          persist={!preview}
        />
      ) : null}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">{greeting}</h1>
        <p className="text-sm sm:text-base text-ink-muted">{formatDateWords(dateKey)}</p>
      </div>

      {isWeekend ? (
        <EmptyState
          icon={PartyPopper}
          title="No school today. Enjoy it."
          description="There's nothing planned for the weekend. See you Monday."
        />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing planned for today"
          description="Check back soon, or ask a parent to set up your weekly schedule."
        />
      ) : (
        <>
          <p className="text-sm font-medium text-ink-muted">
            {cards.length} lesson{cards.length === 1 ? "" : "s"} • about {formatMinutes(view.totalMinutes)}
          </p>

          <div className="space-y-4">
            {cards.map((assignment) => {
              const lesson = assignment.lesson;
              const subject = lesson?.unit.programme.subject;
              const theme = subjectTheme(subject?.slug);
              const isCompleted = assignment.status === "COMPLETED";
              const isInProgress =
                assignment.status === "IN_PROGRESS" || assignment.progress?.status === "IN_PROGRESS";
              const buttonLabel = isCompleted ? "Review" : isInProgress ? "Continue" : "Start";
              const title = lesson?.title ?? assignment.customTitle ?? "Assignment";
              const href = lesson
                ? `/lessons/${lesson.id}?assignmentId=${assignment.id}&kind=${assignment.kind}`
                : undefined;

              return (
                <Card
                  key={assignment.id}
                  padding="lg"
                  className={isCompleted ? "opacity-70" : undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {subject ? (
                          <span className={`text-xs font-semibold uppercase tracking-wide ${theme.text}`}>
                            {subject.title}
                          </span>
                        ) : null}
                        {assignment.kind === "REVIEW" ? (
                          <Badge tone="warning">
                            <Sparkles className="h-3 w-3" /> Quick review
                          </Badge>
                        ) : null}
                        {assignment.optional ? <Badge tone="neutral">Optional</Badge> : null}
                      </div>
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                        {isCompleted ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : null}
                        {title}
                      </h2>
                      <p className="text-sm text-ink-muted">{formatMinutes(assignment.estimatedMinutes)}</p>
                    </div>

                    {href ? (
                      <Button href={href} variant={isCompleted ? "secondary" : "primary"}>
                        {buttonLabel}
                      </Button>
                    ) : (
                      <Badge tone="neutral">Set by a parent</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">Today</span>
                <span className="text-ink-muted">
                  {view.completedToday} / {view.totalToday} completed
                </span>
              </div>
              <ProgressBar
                size="sm"
                value={view.totalToday > 0 ? (view.completedToday / view.totalToday) * 100 : 0}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">This week</span>
                <span className="text-ink-muted">
                  {view.completedWeek} / {view.totalWeek} completed
                </span>
              </div>
              <ProgressBar size="sm" value={view.totalWeek > 0 ? (view.completedWeek / view.totalWeek) * 100 : 0} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
