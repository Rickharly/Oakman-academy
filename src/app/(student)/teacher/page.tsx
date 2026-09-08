import { requireStudent } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TeacherPanel } from "@/components/student/TeacherPanel";

export default async function TeacherPage() {
  await requireStudent();

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] flex-col md:h-[calc(100dvh-8.5rem)]">
      <PageHeader title="Teacher" description="Ask about anything you're learning." />
      <Card padding="lg" className="flex min-h-0 flex-1 flex-col">
        <TeacherPanel />
      </Card>
    </div>
  );
}
