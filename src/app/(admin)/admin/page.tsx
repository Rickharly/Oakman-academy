import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" />
      <EmptyState icon={LayoutGrid} title="Coming soon" description="Per-student summaries will appear here." />
    </>
  );
}
