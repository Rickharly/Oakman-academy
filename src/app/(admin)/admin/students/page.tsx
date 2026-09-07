import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminStudentsPage() {
  return (
    <>
      <PageHeader title="Students" />
      <EmptyState icon={Users} title="Coming soon" description="Your students will appear here." />
    </>
  );
}
