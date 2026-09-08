import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { PartyPopper, Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar, isPhotoAvatar } from "@/components/ui/Avatar";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { ResetProgress } from "@/components/admin/ResetProgress";
import { enrolStudentInYearGroup } from "@/lib/admin/enrol";
import { dayEndsAt } from "@/lib/scheduling/timetable";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { VOICE_OPTIONS } from "@/lib/ai/voice";
import { Button } from "@/components/ui/Button";
import { requireParent, requireParentOfStudent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SCHOOL_TIMEZONE } from "@/lib/dates";

function fieldClass() {
  return "block text-xs font-medium text-ink-muted mb-1";
}

/** "3h45 of lessons, 13:00–17:25" — so the shape of the day is visible before saving. */
function formatDayLength(p: {
  lessonsPerDay: number;
  lessonMinutes: number;
  breakMinutes: number;
  schoolStartTime: string;
}) {
  const teaching = p.lessonsPerDay * p.lessonMinutes;
  const items = Array.from({ length: p.lessonsPerDay }, () => ({ estimatedMinutes: p.lessonMinutes }));
  const ends = dayEndsAt(items, p.schoolStartTime, p.breakMinutes);
  return `${Math.floor(teaching / 60)}h${String(teaching % 60).padStart(2, "0")} of lessons, ${p.schoolStartTime}–${ends}`;
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const parent = await requireParent();
  const { ok, error } = await searchParams;

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: parent.id },
    include: { student: { include: { studentProfile: true } } },
    orderBy: { createdAt: "asc" },
  });
  const students = links.map((l) => l.student).filter((u) => u.studentProfile != null);

  async function changePassword(formData: FormData) {
    "use server";
    const currentParent = await requireParent();
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");

    if (newPassword.length < 8) {
      redirect("/admin/settings?error=" + encodeURIComponent("New password must be at least 8 characters"));
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: currentParent.id } });
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      redirect("/admin/settings?error=" + encodeURIComponent("Current password is incorrect"));
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: currentParent.id }, data: { passwordHash } });
    redirect("/admin/settings?ok=1");
  }

  async function updateStudent(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "");
    const { student } = await requireParentOfStudent(studentId);

    const displayName = String(formData.get("displayName") ?? "").trim();
    const avatar = String(formData.get("avatar") ?? "").trim();
    const yearGroup = Number(formData.get("yearGroup"));
    const keyStage = String(formData.get("keyStage") ?? "").trim();

    // Timetable. Bounded so a slip cannot produce a 30-lesson day or a zero-minute period.
    const lessonsPerDay = Number(formData.get("lessonsPerDay"));
    const lessonMinutes = Number(formData.get("lessonMinutes"));
    const breakMinutes = Number(formData.get("breakMinutes"));
    const schoolStartTime = String(formData.get("schoolStartTime") ?? "").trim();
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(schoolStartTime);

    // Personalisation. Interests are free text, one per line or comma separated — a parent
    // should not have to learn a format to say their son likes football.
    const age = Number(formData.get("age"));
    const interests = String(formData.get("interests") ?? "")
      .split(/[,\n]/)
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 15);
    const teacherNotes = String(formData.get("teacherNotes") ?? "").trim().slice(0, 600);
    const voiceId = String(formData.get("voiceId") ?? "").trim();
    const voiceEnabled = formData.get("voiceEnabled") === "on";

    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.userId },
        // An empty emoji field leaves an uploaded photo alone; the photo has its own control.
        data: { ...(displayName ? { displayName } : {}), ...(avatar ? { avatar } : {}) },
      }),
      prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          ...(Number.isFinite(yearGroup) && yearGroup > 0 ? { yearGroup } : {}),
          ...(keyStage ? { keyStage } : {}),
          ...(Number.isFinite(lessonsPerDay) && lessonsPerDay >= 1 && lessonsPerDay <= 10
            ? { lessonsPerDay }
            : {}),
          ...(Number.isFinite(lessonMinutes) && lessonMinutes >= 10 && lessonMinutes <= 120
            ? { lessonMinutes }
            : {}),
          ...(Number.isFinite(breakMinutes) && breakMinutes >= 0 && breakMinutes <= 60
            ? { breakMinutes }
            : {}),
          ...(validTime ? { schoolStartTime } : {}),
          age: Number.isFinite(age) && age >= 3 && age <= 19 ? age : null,
          interests,
          teacherNotes: teacherNotes || null,
          voiceId: voiceId || null,
          voiceEnabled,
        },
      }),
    ]);
    redirect("/admin/settings?ok=1");
  }

  async function resetPin(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "");
    const pin = String(formData.get("pin") ?? "");
    const { student } = await requireParentOfStudent(studentId);

    if (pin.length < 4 || pin.length > 6) {
      redirect("/admin/settings?error=" + encodeURIComponent("PIN must be 4-6 digits"));
    }
    const passwordHash = await hashPassword(pin);
    await prisma.user.update({ where: { id: student.userId }, data: { passwordHash } });
    redirect("/admin/settings?ok=1");
  }

  /**
   * Clears the "you have seen the welcome" flag so a child gets the first-run walkthrough and
   * the confetti again. Needed more often than you would think: a parent checking the account
   * works burns the child's first login.
   */
  async function replayWelcome(formData: FormData) {
    "use server";
    const studentId = String(formData.get("studentId") ?? "");
    const { student } = await requireParentOfStudent(studentId);

    const preferences = { ...((student.preferences ?? {}) as Record<string, unknown>) };
    delete preferences.welcomeSeenAt;
    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { preferences: preferences as Prisma.InputJsonObject },
    });

    redirect("/admin/settings?ok=1");
  }

  async function addStudent(formData: FormData) {
    "use server";
    const currentParent = await requireParent();
    const displayName = String(formData.get("displayName") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const pin = String(formData.get("pin") ?? "");
    const yearGroup = Number(formData.get("yearGroup"));
    const keyStage = String(formData.get("keyStage") ?? "").trim();

    // A new student takes the default timetable; it is edited above once they exist.
    const avatar = String(formData.get("avatar") ?? "").trim();

    if (!displayName || !username || pin.length < 4 || pin.length > 6 || !Number.isFinite(yearGroup) || !keyStage) {
      redirect("/admin/settings?error=" + encodeURIComponent("Please fill in every field for the new student"));
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      redirect("/admin/settings?error=" + encodeURIComponent("That username is already taken"));
    }

    const passwordHash = await hashPassword(pin);
    const newStudentId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: "STUDENT", username, passwordHash, displayName, avatar: avatar || null },
      });
      await tx.parentStudentLink.create({ data: { parentId: currentParent.id, studentId: user.id } });
      const profile = await tx.studentProfile.create({ data: { userId: user.id, yearGroup, keyStage } });
      return profile.id;
    });

    // A child with an account but no subjects opens Today to an empty page and no explanation.
    // Enrolling them here is what makes "add a student" mean what a parent thinks it means.
    await enrolStudentInYearGroup(newStudentId);

    redirect("/admin/settings?ok=1");
  }

  return (
    <>
      <PageHeader title="Settings" description="Account, students, and system configuration." />

      {ok ? (
        <div className="mb-6 rounded-xl bg-success-soft px-4 py-3 text-sm font-medium text-success">Saved.</div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</div>
      ) : null}

      <Card padding="lg" className="mb-6 space-y-4">
        <h2 className="text-base font-semibold text-ink">Your account</h2>
        <p className="text-sm text-ink-muted">{parent.email}</p>
        <form action={changePassword} className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div>
            <label className={fieldClass()}>Current password</label>
            <Input type="password" name="currentPassword" required autoComplete="current-password" />
          </div>
          <div>
            <label className={fieldClass()}>New password</label>
            <Input type="password" name="newPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Change password</Button>
          </div>
        </form>
      </Card>

      <Card padding="lg" className="mb-6 space-y-6">
        <h2 className="text-base font-semibold text-ink">Student accounts</h2>
        {students.length === 0 ? (
          <p className="text-sm text-ink-muted">No students yet — add one below.</p>
        ) : (
          <div className="space-y-6">
            {students.map((s) => {
              const profile = s.studentProfile!;
              return (
                <div key={s.id} className="space-y-4 rounded-2xl border border-line p-4">
                  <div className="flex items-center gap-3">
                    <Avatar emoji={s.avatar} name={s.displayName} size="md" />
                    <p className="font-medium text-ink">{s.displayName}</p>
                    <span className="text-xs text-ink-faint">@{s.username}</span>
                  </div>

                  <PhotoUpload studentId={profile.id} name={s.displayName} avatar={s.avatar} />

                  <form action={updateStudent} className="grid gap-3 sm:grid-cols-4 sm:items-end">
                    <input type="hidden" name="studentId" value={profile.id} />
                    <div>
                      <label className={fieldClass()}>Display name</label>
                      <Input name="displayName" defaultValue={s.displayName} />
                    </div>
                    <div>
                      <label className={fieldClass()}>
                        {isPhotoAvatar(s.avatar) ? "Emoji (unused while a photo is set)" : "Avatar emoji"}
                      </label>
                      <Input
                        name="avatar"
                        defaultValue={isPhotoAvatar(s.avatar) ? "" : (s.avatar ?? "")}
                        maxLength={4}
                        placeholder="🦊"
                      />
                    </div>
                    <div>
                      <label className={fieldClass()}>Year group</label>
                      <Input type="number" name="yearGroup" defaultValue={profile.yearGroup} min={1} max={13} />
                    </div>
                    <div>
                      <label className={fieldClass()}>Key stage</label>
                      <Input name="keyStage" defaultValue={profile.keyStage} />
                    </div>

                    <div className="sm:col-span-4 border-t border-line pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Timetable
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {profile.lessonsPerDay} × {profile.lessonMinutes} min from {profile.schoolStartTime}, with{" "}
                        {profile.breakMinutes} min breaks — {formatDayLength(profile)}.
                      </p>
                    </div>
                    <div>
                      <label className={fieldClass()}>Starts at</label>
                      <Input name="schoolStartTime" type="time" defaultValue={profile.schoolStartTime} />
                    </div>
                    <div>
                      <label className={fieldClass()}>Lessons a day</label>
                      <Input type="number" name="lessonsPerDay" defaultValue={profile.lessonsPerDay} min={1} max={10} />
                    </div>
                    <div>
                      <label className={fieldClass()}>Minutes each</label>
                      <Input type="number" name="lessonMinutes" defaultValue={profile.lessonMinutes} min={10} max={120} step={5} />
                    </div>
                    <div>
                      <label className={fieldClass()}>Break minutes</label>
                      <Input type="number" name="breakMinutes" defaultValue={profile.breakMinutes} min={0} max={60} step={5} />
                    </div>

                    <div className="sm:col-span-4 border-t border-line pt-4">
                      <p className="text-sm font-semibold text-ink">Making it theirs</p>
                      <p className="text-xs text-ink-muted">
                        The teacher uses this to pitch explanations and choose examples. A child
                        who is told about fractions using their own football team is listening to
                        something about them.
                      </p>
                    </div>

                    <div>
                      <label className={fieldClass()}>Age</label>
                      <Input type="number" name="age" min={3} max={19} defaultValue={profile.age ?? ""} />
                    </div>

                    <div className="sm:col-span-3">
                      <label className={fieldClass()}>What they&apos;re into</label>
                      <Input
                        name="interests"
                        defaultValue={(Array.isArray(profile.interests) ? (profile.interests as string[]) : []).join(", ")}
                        placeholder="football, Minecraft, horses, drawing"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className={fieldClass()}>Anything the teacher should know</label>
                      <Textarea
                        name="teacherNotes"
                        rows={2}
                        defaultValue={profile.teacherNotes ?? ""}
                        placeholder="Gives up quickly when stuck. Loves being asked to explain things back."
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={fieldClass()}>The teacher&apos;s voice</label>
                      <select
                        name="voiceId"
                        defaultValue={profile.voiceId ?? ""}
                        className="h-11 w-full rounded-xl border border-line bg-surface-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                      >
                        <option value="">Default</option>
                        {VOICE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label} — {v.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          name="voiceEnabled"
                          defaultChecked={profile.voiceEnabled}
                          className="h-5 w-5 rounded border-line text-accent focus:ring-accent-soft"
                        />
                        Read explanations aloud
                      </label>
                    </div>

                    <div className="sm:col-span-4">
                      <Button type="submit" variant="secondary">
                        Save changes
                      </Button>
                    </div>
                  </form>

                  <div className="mb-3">
                    <ResetProgress studentId={profile.id} name={s.displayName} />
                  </div>

                  <form action={replayWelcome} className="mb-3">
                    <input type="hidden" name="studentId" value={profile.id} />
                    <button
                      type="submit"
                      className="flex h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-stone-100"
                    >
                      <PartyPopper className="h-4 w-4 text-ink-muted" />
                      Show the welcome again on next login
                    </button>
                  </form>

                  <form action={resetPin} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="studentId" value={profile.id} />
                    <div>
                      <label className={fieldClass()}>New PIN (4-6 digits)</label>
                      <Input name="pin" inputMode="numeric" minLength={4} maxLength={6} required className="w-36" />
                    </div>
                    <Button type="submit" variant="secondary">
                      Reset PIN
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <details className="rounded-2xl border border-dashed border-line p-4">
          <summary className="cursor-pointer text-sm font-medium text-ink">Add a student</summary>
          <form action={addStudent} className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <label className={fieldClass()}>Display name</label>
              <Input name="displayName" required />
            </div>
            <div>
              <label className={fieldClass()}>Username</label>
              <Input name="username" required />
            </div>
            <div>
              <label className={fieldClass()}>PIN (4-6 digits)</label>
              <Input name="pin" inputMode="numeric" minLength={4} maxLength={6} required />
            </div>
            <div>
              <label className={fieldClass()}>Year group</label>
              <Input type="number" name="yearGroup" min={1} max={13} required />
            </div>
            <div>
              <label className={fieldClass()}>Key stage</label>
              <Input name="keyStage" placeholder="ks2" required />
            </div>
            <div>
              <label className={fieldClass()}>Avatar emoji</label>
              <Input name="avatar" maxLength={4} placeholder="🙂" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Add student</Button>
            </div>
          </form>
        </details>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card padding="lg" className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <SettingsIcon className="h-4 w-4 text-ink-muted" /> AI settings
          </h2>
          <p className="text-sm text-ink-muted">
            Active provider: <span className="font-medium text-ink">{(process.env.AI_PROVIDER || "mock").toLowerCase()}</span>
          </p>
          <p className="text-xs text-ink-faint">Set via the AI_PROVIDER environment variable. Read-only here.</p>
        </Card>

        <Card padding="lg" className="space-y-3">
          <h2 className="text-base font-semibold text-ink">School timezone</h2>
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">{SCHOOL_TIMEZONE}</span>
          </p>
          <p className="text-xs text-ink-faint">Set via the SCHOOL_TIMEZONE environment variable. Read-only here.</p>
        </Card>
      </div>
    </>
  );
}
