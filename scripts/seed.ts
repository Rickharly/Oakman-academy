/**
 * Seeds a usable school: the parent account, the two student accounts, the bundled curriculum,
 * enrolments and the weekly schedule.
 *
 * Idempotent — safe to run on every deploy. Existing accounts are updated, never duplicated,
 * and passwords are only reset when the account is created (so a password changed in the app
 * is not clobbered by the next deploy).
 *
 *   SEED_MODE=if-empty          (default) skip entirely when students already exist
 *   SEED_MODE=always            re-run the upserts and re-sync the curriculum
 *   SEED_RESET_CREDENTIALS=true reset the parent's email/password and the students' PINs to
 *                               the configured values, for when you are locked out
 */
import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { FixtureProvider } from "@/lib/curriculum/fixture-provider";
import { syncMany, type SyncScope } from "@/lib/curriculum/sync";
import { seedReadingLibrary } from "@/lib/reading/library";

const SUBJECTS = ["maths", "english", "science", "history", "geography"] as const;

/** Weekly lesson frequency per subject (spec §29), with maths and English scheduled first. */
const SCHEDULE_RULES: { subject: string; weeklyFrequency: number; priority: number }[] = [
  { subject: "maths", weeklyFrequency: 5, priority: 3 },
  { subject: "english", weeklyFrequency: 5, priority: 2 },
  { subject: "science", weeklyFrequency: 3, priority: 1 },
  { subject: "history", weeklyFrequency: 2, priority: 1 },
  { subject: "geography", weeklyFrequency: 2, priority: 1 },
];

/**
 * `previousUsernames` lets an account be renamed rather than duplicated: the seed looks the
 * student up under the old name too, so a spelling correction reaches an account that already
 * exists instead of quietly creating a second child alongside it.
 */
const STUDENTS: {
  username: string;
  displayName: string;
  avatar: string;
  pin: string;
  yearGroup: number;
  keyStage: string;
  previousUsernames?: string[];
}[] = [
  { username: "eva", displayName: "Eva", avatar: "🦊", pin: "1234", yearGroup: 7, keyStage: "ks3" },
  {
    username: "mikhael",
    displayName: "Mikhael",
    avatar: "🐻",
    pin: "5678",
    yearGroup: 5,
    keyStage: "ks2",
    previousUsernames: ["mikhail"],
  },
];

/**
 * Brings existing student accounts in line with the roster above — their username, how their
 * name is displayed, and their emoji if they have not been given a photo. Never touches
 * passwords, enrolments or any learning history.
 */
async function reconcileStudentIdentities(): Promise<void> {
  for (const spec of STUDENTS) {
    const user =
      (await prisma.user.findUnique({ where: { username: spec.username } })) ??
      (await prisma.user.findFirst({ where: { username: { in: spec.previousUsernames ?? [] } } }));
    if (!user) continue;

    const keepsPhoto = Boolean(user.avatar?.startsWith("data:"));
    const changed = user.username !== spec.username || user.displayName !== spec.displayName;
    if (!changed) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        username: spec.username,
        displayName: spec.displayName,
        ...(keepsPhoto ? {} : { avatar: spec.avatar }),
      },
    });
    console.log(`[seed] renamed ${user.displayName} (@${user.username}) → ${spec.displayName} (@${spec.username})`);
  }
}

async function main() {
  const mode = process.env.SEED_MODE ?? "if-empty";
  const resetCredentials = /^(1|true|yes)$/i.test(process.env.SEED_RESET_CREDENTIALS ?? "");

  // The reading library is bundled content, not learning history: upserting it every boot is
  // how a passage added to a fixture file reaches the children without a special command.
  const readingTexts = await seedReadingLibrary();
  console.log(`[seed] reading library: ${readingTexts} passage(s).`);

  if (mode === "if-empty" && !resetCredentials) {
    const existing = await prisma.studentProfile.count();
    if (existing > 0) {
      // The expensive part (importing the curriculum) is skipped, but a child's name is
      // cheap to reconcile and worth doing every deploy: a correction to how their name is
      // spelled should reach them without anyone having to remember a flag.
      await reconcileStudentIdentities();
      console.log(`[seed] ${existing} student profile(s) already exist — curriculum import skipped.`);
      return;
    }
  }

  // ---- parent ----
  const parentEmail = (process.env.SEED_PARENT_EMAIL ?? "parent@example.com").trim().toLowerCase();
  const parentPassword = process.env.SEED_PARENT_PASSWORD ?? "change-me-now";

  // An account already created on an earlier boot keeps its password: a password changed in
  // the app must not be silently reverted by the next deploy. SEED_RESET_CREDENTIALS is the
  // deliberate way back in when the configured values and the stored ones have diverged.
  const byEmail = await prisma.user.findUnique({ where: { email: parentEmail } });
  const anyParent = byEmail ?? (await prisma.user.findFirst({ where: { role: "PARENT" }, orderBy: { createdAt: "asc" } }));

  let parent;
  if (!anyParent) {
    parent = await prisma.user.create({
      data: {
        role: "PARENT",
        email: parentEmail,
        displayName: "Parent",
        passwordHash: await hashPassword(parentPassword),
      },
    });
    console.log(`[seed] parent ${parentEmail} created`);
  } else if (resetCredentials) {
    // Also adopts the existing account when SEED_PARENT_EMAIL has since changed, so a
    // reset never leaves an orphaned parent behind under the old address.
    parent = await prisma.user.update({
      where: { id: anyParent.id },
      data: { role: "PARENT", email: parentEmail, passwordHash: await hashPassword(parentPassword) },
    });
    console.log(
      `[seed] parent credentials reset to ${parentEmail}` +
        (anyParent.email !== parentEmail ? ` (was ${anyParent.email})` : ""),
    );
  } else {
    parent = await prisma.user.update({ where: { id: anyParent.id }, data: { role: "PARENT" } });
    console.log(
      `[seed] parent ${anyParent.email} already exists — password left unchanged` +
        (anyParent.email !== parentEmail
          ? `. It does NOT match SEED_PARENT_EMAIL (${parentEmail}); set SEED_RESET_CREDENTIALS=true to move it.`
          : ". Set SEED_RESET_CREDENTIALS=true to reset it."),
    );
  }

  // ---- curriculum (always from the bundled fixture provider; Oak is synced separately) ----
  const provider = new FixtureProvider();
  const available = await provider.getSubjects();
  const availableSlugs = new Set(available.map((s) => s.slug));

  const scopes: SyncScope[] = [];
  for (const student of STUDENTS) {
    for (const subject of SUBJECTS) {
      if (!availableSlugs.has(subject)) continue;
      const programmes = await provider.getProgrammes(subject).catch(() => []);
      if (!programmes.some((p) => p.yearGroup === student.yearGroup)) continue;
      scopes.push({ subjectSlug: subject, yearGroup: student.yearGroup });
    }
  }

  console.log(`[seed] importing ${scopes.length} programme(s) from the bundled curriculum…`);
  const { programmeIds, failures } = await syncMany(scopes, { provider, log: (l) => console.log(`  ${l}`) });
  for (const f of failures) {
    console.warn(`[seed] ${f.scope.subjectSlug} year ${f.scope.yearGroup} failed: ${f.error}`);
  }

  // ---- students, enrolments, schedules ----
  for (const spec of STUDENTS) {
    const existingUser =
      (await prisma.user.findUnique({
        where: { username: spec.username },
        include: { studentProfile: true },
      })) ??
      (await prisma.user.findFirst({
        where: { username: { in: spec.previousUsernames ?? [] } },
        include: { studentProfile: true },
      }));

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            username: spec.username,
            displayName: spec.displayName,
            role: "STUDENT",
            // An uploaded photo is never replaced by the default emoji.
            ...(existingUser.avatar && existingUser.avatar.startsWith("data:") ? {} : { avatar: spec.avatar }),
            ...(resetCredentials ? { passwordHash: await hashPassword(spec.pin) } : {}),
          },
        })
      : await prisma.user.create({
          data: {
            role: "STUDENT",
            username: spec.username,
            displayName: spec.displayName,
            avatar: spec.avatar,
            passwordHash: await hashPassword(spec.pin),
          },
        });

    const profile = existingUser?.studentProfile
      ? await prisma.studentProfile.update({
          where: { id: existingUser.studentProfile.id },
          data: { yearGroup: spec.yearGroup, keyStage: spec.keyStage },
        })
      : await prisma.studentProfile.create({
          data: {
            userId: user.id,
            yearGroup: spec.yearGroup,
            keyStage: spec.keyStage,
            dailyTargetMinutes: 180,
            maxDailyMinutes: 210,
          },
        });

    await prisma.parentStudentLink.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: user.id } },
      create: { parentId: parent.id, studentId: user.id },
      update: {},
    });

    // Enrol in every programme for this student's year group.
    const programmes = await prisma.programme.findMany({
      where: { id: { in: programmeIds }, yearGroup: spec.yearGroup },
      include: { subject: true },
    });

    for (const programme of programmes) {
      await prisma.studentEnrolment.upsert({
        where: { studentId_programmeId: { studentId: profile.id, programmeId: programme.id } },
        create: { studentId: profile.id, programmeId: programme.id },
        update: { active: true },
      });

      const rule = SCHEDULE_RULES.find((r) => r.subject === programme.subject.slug);
      if (!rule) continue;

      await prisma.studentSchedule.upsert({
        where: { studentId_subjectId: { studentId: profile.id, subjectId: programme.subjectId } },
        create: {
          studentId: profile.id,
          subjectId: programme.subjectId,
          weeklyFrequency: rule.weeklyFrequency,
          priority: rule.priority,
        },
        update: { weeklyFrequency: rule.weeklyFrequency, priority: rule.priority, active: true },
      });
    }

    console.log(
      `[seed] ${spec.displayName} (year ${spec.yearGroup}) — ${programmes.length} subject(s)` +
        `${!existingUser || resetCredentials ? `, PIN ${spec.pin}` : ""}`,
    );
  }

  const lessons = await prisma.lesson.count();
  const questions = await prisma.question.count();
  console.log(`[seed] ready: ${lessons} lessons, ${questions} questions.`);
  console.log(`[seed] Log in at /login as ${parent.email}. Change every password and PIN now.`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
