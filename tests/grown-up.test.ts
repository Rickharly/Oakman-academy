import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { POST as grownUp } from "@/app/api/student/grown-up/route";
import { startOrResumeAttempt } from "@/lib/lessons/service";
import { schoolDayKey, toDateOnly } from "@/lib/dates";
import { resetDb } from "./helpers/db";

/** "If he comes to me and he's stuck, I just press a button and he moves on — under my control." */
async function setup() {
  const parent = await prisma.user.create({
    data: { role: "PARENT", email: "p@example.test", passwordHash: await hashPassword("parent-secret"), displayName: "Rick" },
  });
  const kid = await prisma.user.create({
    data: { role: "STUDENT", username: "mikhael", passwordHash: await hashPassword("5678"), displayName: "Mikhael" },
  });
  await prisma.parentStudentLink.create({ data: { parentId: parent.id, studentId: kid.id } });
  const student = await prisma.studentProfile.create({ data: { userId: kid.id, yearGroup: 4, keyStage: "ks2" } });
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: kid.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  const subject = await prisma.subject.create({ data: { provider: "oak", slug: "maths", title: "Maths" } });
  const programme = await prisma.programme.create({
    data: { provider: "oak", providerSlug: "maths:4", subjectId: subject.id, yearGroup: 4, keyStage: "ks2", title: "Maths" },
  });
  const unit = await prisma.unit.create({ data: { provider: "oak", providerSlug: "u", programmeId: programme.id, title: "U", order: 1 } });
  const a = await prisma.lesson.create({ data: { provider: "oak", providerSlug: "a", unitId: unit.id, title: "Factors", order: 1 } });
  const b = await prisma.lesson.create({ data: { provider: "oak", providerSlug: "b", unitId: unit.id, title: "Multiples", order: 2 } });
  const slot = await prisma.dailyAssignment.create({
    data: { studentId: student.id, date: toDateOnly(schoolDayKey()), kind: "LESSON", subjectId: subject.id, lessonId: a.id, estimatedMinutes: 48, order: 0, source: "AUTO" },
  });
  await startOrResumeAttempt(student.id, a.id, slot.id);
  const call = (body: object) =>
    grownUp(
      new Request("http://localhost/api/student/grown-up", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
        body: JSON.stringify(body),
      }),
    );
  return { call, slot, b, student };
}

describe("grown-up controls on the child's tablet", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("refuses without the parent's password", async () => {
    const { call, slot } = await setup();
    const res = await call({ password: "wrong", action: "end-period" });
    expect(res.status).toBe(403);
    expect((await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("IN_PROGRESS");
  });

  it("moves him to the next lesson with the parent's password", async () => {
    const { call, slot, b } = await setup();
    const res = await call({ password: "parent-secret", action: "next-lesson" });
    expect(res.status).toBe(200);
    expect((await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } })).lessonId).toBe(b.id);
  });

  it("ends the period with the parent's password", async () => {
    const { call, slot } = await setup();
    const res = await call({ password: "parent-secret", action: "end-period" });
    expect(res.status).toBe(200);
    expect((await prisma.dailyAssignment.findUniqueOrThrow({ where: { id: slot.id } })).status).toBe("COMPLETED");
  });
});
