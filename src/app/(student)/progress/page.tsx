import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProgressPage() {
  return (
    <>
      <PageHeader title="Progress" />
      <EmptyState icon={TrendingUp} title="Coming soon" description="Your progress will appear here." />
    </>
  );
}
