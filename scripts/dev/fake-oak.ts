/** Test helper: clones the bundled programmes under the `oak` provider so the switch-over
 *  in scripts/oak-sync.ts can be exercised without reaching Oak. */
import "dotenv/config";
import { prisma } from "@/lib/db";

async function main() {
  const programmes = await prisma.programme.findMany({ where: { provider: "fixture" }, include: { subject: true, units: { include: { lessons: true } } } });
  for (const p of programmes) {
    const subject = await prisma.subject.upsert({
      where: { provider_slug: { provider: "oak", slug: p.subject.slug } },
      create: { provider: "oak", slug: p.subject.slug, title: p.subject.title },
      update: {},
    });
    const prog = await prisma.programme.upsert({
      where: { provider_providerSlug: { provider: "oak", providerSlug: `${p.sequenceSlug}-oak:${p.yearGroup}` } },
      create: { provider: "oak", providerSlug: `${p.sequenceSlug}-oak:${p.yearGroup}`, sequenceSlug: p.sequenceSlug, subjectId: subject.id, yearGroup: p.yearGroup, keyStage: p.keyStage, title: p.title },
      update: {},
    });
    for (const u of p.units) {
      const unit = await prisma.unit.upsert({
        where: { programmeId_providerSlug: { programmeId: prog.id, providerSlug: u.providerSlug } },
        create: { provider: "oak", providerSlug: u.providerSlug, programmeId: prog.id, title: u.title, order: u.order },
        update: {},
      });
      for (const l of u.lessons) {
        await prisma.lesson.upsert({
          where: { provider_providerSlug: { provider: "oak", providerSlug: l.providerSlug } },
          create: { provider: "oak", providerSlug: l.providerSlug, unitId: unit.id, title: l.title, order: l.order, estimatedMinutes: l.estimatedMinutes },
          update: {},
        });
      }
    }
  }
  console.log(`cloned ${programmes.length} programme(s) under the oak provider`);
}
main().finally(() => prisma.$disconnect());
