import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader title="Reports" />
      <EmptyState icon={BarChart3} title="Coming soon" description="Weekly and monthly reports will appear here." />
    </>
  );
}
