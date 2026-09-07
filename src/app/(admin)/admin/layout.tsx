import { requireParent } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireParent();

  return (
    <div className="lg:flex lg:min-h-screen">
      <AdminNav displayName={user.displayName} avatar={user.avatar} />
      <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">{children}</main>
    </div>
  );
}
