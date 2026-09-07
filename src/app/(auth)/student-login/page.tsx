import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listStudentAvatars } from "@/lib/auth/login";
import { StudentLoginClient } from "./StudentLoginClient";

export default async function StudentLoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "PARENT" ? "/admin" : "/today");
  }

  const avatars = await listStudentAvatars();

  return <StudentLoginClient avatars={avatars} />;
}
