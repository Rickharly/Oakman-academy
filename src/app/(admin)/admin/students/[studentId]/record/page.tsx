import { requireParentOfStudent } from "@/lib/auth/session";
import { buildAcademicRecord } from "@/lib/records/academic-record";
import { LogoLockup } from "@/components/ui/Logo";
import { GenerateNotesButton } from "@/components/admin/GenerateNotesButton";
import { prisma } from "@/lib/db";
import type { AcademicRecord } from "@/lib/records/academic-record";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-3">
      <h2 className="border-b border-stone-300 pb-1 text-sm font-semibold uppercase tracking-wide text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The record as a school would receive it: one page to read, print, or save as PDF.
 *
 * Print styles matter here — the parent's route to a shareable document is the browser's own
 * "Save as PDF", so the page is laid out for A4 with the app's furniture hidden.
 */
export default async function AcademicRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { studentId } = await params;
  const { saved } = await searchParams;
  await requireParentOfStudent(studentId);

  // A saved record is the exact document that was handed over; a fresh one reflects today.
  const stored = saved
    ? await prisma.report.findFirst({
        where: { id: saved, studentId, period: "ACADEMIC_RECORD" },
      })
    : null;

  const record = stored
    ? (stored.data as unknown as AcademicRecord)
    : await buildAcademicRecord(studentId);

  const generatedAt = new Date(record.generatedAt);

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-white p-2 print:max-w-none print:p-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-muted">
          Print or save as PDF from your browser. Generate the teacher&apos;s notes first if you
          want them included.
        </p>
        <GenerateNotesButton studentId={studentId} />
      </div>

      {/* Letterhead */}
      <header className="flex items-start gap-4 border-b-2 border-brand-navy pb-4">
        <LogoLockup size={64} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-brand-navy">Oakman Academy</h1>
          <p className="text-sm text-ink-muted">Home education · Academic record</p>
        </div>
        <div className="text-right text-xs text-ink-muted">
          <p>Issued {generatedAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
          {record.periodStart && record.periodEnd ? (
            <p>
              Covering {record.periodStart} to {record.periodEnd}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-1 sm:grid-cols-2">
        <p className="text-lg font-semibold text-ink">{record.student.name}</p>
        <p className="text-sm text-ink-muted sm:text-right">
          Year {record.student.yearGroup} · Key Stage {record.student.keyStage.replace("KS", "")} ·
          England
        </p>
      </div>

      <Section title="At a glance">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ["Lessons completed", record.totals.lessonsCompleted],
            ["Questions answered", record.totals.questionsAnswered],
            ["Instructional hours", record.totals.instructionalHours],
            ["Days attended", record.totals.daysAttended],
            [
              "Average assessment",
              record.totals.averageAssessmentPct == null
                ? "—"
                : `${record.totals.averageAssessmentPct}%`,
            ],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-ink-muted">{label}</dt>
              <dd className="text-lg font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Attendance and application">
        <p className="text-sm leading-relaxed text-ink">
          {record.attendance.daysAttended} school{" "}
          {record.attendance.daysAttended === 1 ? "day" : "days"} recorded.{" "}
          {record.attendance.onTimeStarts + record.attendance.lateStarts > 0 ? (
            <>
              {record.attendance.onTimeStarts} of{" "}
              {record.attendance.onTimeStarts + record.attendance.lateStarts}{" "}
              {record.attendance.onTimeStarts + record.attendance.lateStarts === 1
                ? "lesson began"
                : "lessons began"}{" "}
              within five minutes of their scheduled time.{" "}
            </>
          ) : null}
          {record.attendance.averageStartTime
            ? `The school day typically began at ${record.attendance.averageStartTime}. `
            : ""}
          {record.attendance.focusPct != null
            ? `${record.attendance.focusPct}% of time at the screen was spent actively working, measured by interaction; time the child flagged as a break is excluded rather than counted against them.`
            : ""}
        </p>
      </Section>

      {record.subjects.map((subject) => (
        <Section key={subject.subjectTitle} title={subject.subjectTitle}>
          <p className="text-xs text-ink-muted">{subject.framework}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink">
            <span>
              <strong>{subject.lessonsCompleted}</strong> lessons completed
            </span>
            {subject.averageAssessmentPct != null ? (
              <span>
                Average assessment <strong>{subject.averageAssessmentPct}%</strong>
              </span>
            ) : null}
            {subject.masteryPct != null ? (
              <span>
                Mastery <strong>{subject.masteryPct}%</strong>
              </span>
            ) : null}
          </div>

          {subject.note ? (
            <p className="border-l-2 border-stone-300 pl-3 text-sm italic leading-relaxed text-ink">
              {subject.note}
            </p>
          ) : null}

          {subject.units.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Content covered
              </p>
              <ul className="mt-1 space-y-1 text-sm text-ink">
                {subject.units.map((u) => (
                  <li key={u.title}>
                    <span className="font-medium">{u.title}</span>{" "}
                    <span className="text-ink-muted">
                      ({u.lessonsCompleted} of {u.lessonsTotal}) — {u.lessonTitles.join("; ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {subject.assessments.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Assessments
              </p>
              <table className="mt-1 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="py-1 font-medium">Date</th>
                    <th className="py-1 font-medium">Lesson</th>
                    <th className="py-1 text-right font-medium">Score</th>
                    <th className="py-1 text-right font-medium">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {subject.assessments.map((a, i) => (
                    <tr key={i} className="border-t border-stone-200">
                      <td className="py-1 text-ink-muted">{a.date}</td>
                      <td className="py-1 text-ink">{a.lesson}</td>
                      <td className="py-1 text-right font-medium text-ink">{a.scorePct}%</td>
                      <td className="py-1 text-right text-ink-muted">{a.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {subject.needsWork.length > 0 ? (
            <p className="text-sm text-ink">
              <span className="font-medium">Not yet secure: </span>
              <span className="text-ink-muted">{subject.needsWork.join("; ")}</span>
            </p>
          ) : null}
        </Section>
      ))}

      {record.writing.length > 0 ? (
        <Section title="Samples of the child's own writing">
          <p className="text-xs text-ink-muted">
            Reproduced exactly as written, including spelling.
          </p>
          <ul className="space-y-4">
            {record.writing.slice(0, 6).map((w, i) => (
              <li key={i} className="break-inside-avoid space-y-1">
                <p className="text-xs text-ink-muted">
                  {w.date} · {w.title}
                  {w.score != null && w.maxScore != null ? ` · marked ${w.score}/${w.maxScore}` : ""}
                </p>
                <p className="text-xs font-medium text-ink">{w.prompt}</p>
                <p className="whitespace-pre-wrap border-l-2 border-stone-300 pl-3 text-sm leading-relaxed text-ink">
                  {w.response}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="How this record was produced">
        <p className="text-xs leading-relaxed text-ink-muted">{record.provenance}</p>
      </Section>
    </div>
  );
}
