import { PageHeader } from "@/components/ui/PageHeader";
import { requireParent } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { DiagnosticsPanel } from "@/components/admin/DiagnosticsPanel";
import { FindTheirLevel } from "@/components/admin/FindTheirLevel";

/**
 * One page that says what is broken.
 *
 * Built because the alternative was diagnosing failures by reasoning about them from a machine
 * that cannot reach any of the services involved — which was wrong three times about the video
 * alone, and each wrong answer cost part of a school day.
 */
export default async function DiagnosticsPage() {
  const parent = await requireParent();

  const students = await prisma.studentProfile.findMany({
    where: { user: { studentLinks: { some: { parentId: parent.id } } } },
    include: { user: { select: { displayName: true } } },
  });

  return (
    <>
      <PageHeader
        title="What's working"
        description="Runs the real checks against the real services and reports exactly what they say."
      />
      <div className="space-y-4">
        <FindTheirLevel
          students={students.map((s) => ({ id: s.id, name: s.user.displayName }))}
        />
        <DiagnosticsPanel />
      </div>
    </>
  );
}
