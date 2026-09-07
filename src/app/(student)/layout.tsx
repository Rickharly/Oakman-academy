import { requireStudent } from "@/lib/auth/session";
import { StudentNav } from "@/components/student/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();

  return (
    <>
      <StudentNav displayName={user.displayName} avatar={user.avatar} />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 pb-24 md:pb-10">{children}</main>
    </>
  );
}
