import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState icon={Settings} title="Coming soon" description="Account and AI settings will appear here." />
    </>
  );
}
