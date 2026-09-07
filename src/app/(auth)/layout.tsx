import type { ReactNode } from "react";
import { LogoLockup } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-9 flex justify-center">
          <LogoLockup size={104} />
        </div>
        <div className="rounded-2xl border border-line bg-surface-raised p-8">{children}</div>
      </div>
    </div>
  );
}
