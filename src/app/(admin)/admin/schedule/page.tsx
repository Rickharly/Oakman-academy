import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminSchedulePage() {
  return (
    <>
      <PageHeader title="Schedule" />
      <EmptyState icon={Calendar} title="Coming soon" description="Weekly schedules will appear here." />
    </>
  );
}
