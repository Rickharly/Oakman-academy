import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SubjectsPage() {
  return (
    <>
      <PageHeader title="Subjects" />
      <EmptyState icon={BookOpen} title="Coming soon" description="Your subjects will appear here." />
    </>
  );
}
