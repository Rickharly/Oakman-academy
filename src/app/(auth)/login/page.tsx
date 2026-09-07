import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { loginParent } from "@/lib/auth/login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "PARENT" ? "/admin" : "/today");
  }

  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    const loggedInUser = await loginParent(email, password);
    if (!loggedInUser) {
      redirect("/login?error=1");
    }
    await createSession(loggedInUser.id);
    redirect("/admin");
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink">Parent login</h1>
      <p className="mt-1 text-sm text-ink-muted">Sign in to manage your family&apos;s learning.</p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Incorrect email or password.
        </p>
      )}

      <form action={login} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Student?{" "}
        <Link href="/student-login" className="font-medium text-ink-muted underline underline-offset-2">
          Go to student login
        </Link>
      </p>
    </div>
  );
}
