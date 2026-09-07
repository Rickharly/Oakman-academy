import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-8 text-center text-sm font-medium uppercase tracking-wide text-stone-400">
          Family School
        </p>
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
