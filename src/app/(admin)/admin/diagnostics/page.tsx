import { PageHeader } from "@/components/ui/PageHeader";
import { requireParent } from "@/lib/auth/session";
import { DiagnosticsPanel } from "@/components/admin/DiagnosticsPanel";

/**
 * One page that says what is broken.
 *
 * Built because the alternative was diagnosing failures by reasoning about them from a machine
 * that cannot reach any of the services involved — which was wrong three times about the video
 * alone, and each wrong answer cost part of a school day.
 */
export default async function DiagnosticsPage() {
  await requireParent();

  return (
    <>
      <PageHeader
        title="What's working"
        description="Runs the real checks against the real services and reports exactly what they say."
      />
      <DiagnosticsPanel />
    </>
  );
}
