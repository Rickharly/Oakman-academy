import { Sun } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Today" />
      <EmptyState icon={Sun} title="Coming soon" description="Today's assignments will appear here." />
    </>
  );
}
