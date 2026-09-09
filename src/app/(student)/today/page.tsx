import { formatInTimeZone } from "date-fns-tz";
import { BookOpen, CalendarClock, CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { requireStudent } from "@/lib/auth/session";
import { SCHOOL_TIMEZONE, isoWeekday, schoolDayKey } from "@/lib/dates";
import { ensureDayPlanned, getTodayView } from "@/lib/scheduling/planner";
import { subjectSupply } from "@/lib/scheduling/gaps";
import { catchUpRunning } from "@/lib/curriculum/autofill";
import { WaitingForLessons } from "@/components/student/WaitingForLessons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { subjectTheme } from "@/components/student/subjectTheme";
import { firstName, formatDateWords, formatMinutes, greetingForHour } from "@/components/student/format";
import { WelcomeOverlay } from "@/components/student/WelcomeOverlay";
import { buildTimetable, dayEndsAt, teachingMinutes } from "@/lib/scheduling/timetable";

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

  // A short day has a reason, and the child is the one looking at it. Better they read "two
  // subjects are waiting on lessons" than wonder whether they have missed something.
  const lessonsToday = view.assignments.filter((a) => a.kind === "LESSON" && a.status !== "MOVED").length;
  const lessonsPerDay = user.studentProfile.lessonsPerDay;
  const short = lessonsToday > 0 && lessonsToday < lessonsPerDay;
  const waiting = short
    ? (await subjectSupply(profileId).catch(() => [])).filter((s) => !s.healthy).map((s) => s.subjectTitle)
    : [];
  // A short day starts a catch-up import by itself (see `ensureDayPlanned`). When one is
  // running, say so and let the page bring the lessons in rather than needing a grown-up.
  const fetching = short ? await catchUpRunning().catch(() => false) : false;
  const cards = view.assignments.filter((a) => a.status !== "MOVED");

  // Real clock times for the day, so it reads like a timetable rather than a to-do list.
  const { breakMinutes, schoolStartTime } = user.studentProfile;
  const timetable = new Map(
    buildTimetable(
      cards.map((a) => ({ id: a.id, estimatedMinutes: a.estimatedMinutes, kind: a.kind })),
      schoolStartTime,
      breakMinutes,
    ).map((entry) => [entry.assignmentId, entry]),
  );
  const finishesAt = dayEndsAt(cards, schoolStartTime, breakMinutes);
  const lessonCount = cards.filter((a) => a.kind === "LESSON").length;

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
            {lessonCount} lesson{lessonCount === 1 ? "" : "s"} •{" "}
            {formatMinutes(teachingMinutes(cards))} of work • {schoolStartTime} to {finishesAt}
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
              const isReading = assignment.kind === "READING";
              const title = isReading
                ? "Reading"
                : (lesson?.title ?? assignment.customTitle ?? "Assignment");
              const href = isReading
                ? `/reading?assignmentId=${assignment.id}`
                : lesson
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
                        {timetable.get(assignment.id)?.period ? (
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-ink-muted">
                            Period {timetable.get(assignment.id)!.period}
                          </span>
                        ) : null}
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
                        {isReading ? (
                          <Badge tone="neutral">
                            <BookOpen className="h-3 w-3" /> Reading & writing
                          </Badge>
                        ) : null}
                        {assignment.optional ? <Badge tone="neutral">Optional</Badge> : null}
                      </div>
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                        {isCompleted ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : null}
                        {title}
                      </h2>
                      <p className="text-sm text-ink-muted">
                        {timetable.get(assignment.id)
                          ? `${timetable.get(assignment.id)!.startsAt} – ${timetable.get(assignment.id)!.endsAt} · `
                          : ""}
                        {formatMinutes(assignment.estimatedMinutes)}
                      </p>
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

          {/*
            Why today is shorter than usual.

            A day is only ever short because a subject has no lessons left to give, and until
            this said so the only visible symptom was a day that looked wrong. Naming the
            subjects turns "something is broken" into "someone needs to import geography".
          */}
          {short && fetching ? (
            <WaitingForLessons subjects={waiting} />
          ) : short && waiting.length > 0 ? (
            <Card padding="md" className="border-line bg-surface-raised">
              <p className="text-sm text-ink">
                Today is {lessonsToday} {lessonsToday === 1 ? "lesson" : "lessons"} rather than the
                usual {lessonsPerDay} — {waiting.join(" and ")}{" "}
                {waiting.length === 1 ? "is" : "are"} waiting for new lessons to be added.
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Nothing you did. Do these ones, and the rest will be back.
              </p>
            </Card>
          ) : null}

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
