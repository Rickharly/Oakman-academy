import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TeacherPage() {
  return (
    <>
      <PageHeader title="Teacher" />
      <EmptyState icon={MessageCircle} title="Coming soon" description="Chat with your AI teacher here." />
    </>
  );
}
