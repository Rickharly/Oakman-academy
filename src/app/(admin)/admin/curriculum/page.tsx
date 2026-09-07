import { Library } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminCurriculumPage() {
  return (
    <>
      <PageHeader title="Curriculum" />
      <EmptyState icon={Library} title="Coming soon" description="Imported curriculum will appear here." />
    </>
  );
}
