import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LogoMark size={72} />
          <div className="text-center leading-none">
            <p className="text-xl font-semibold tracking-tight text-brand-navy">Oakman Academy</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface-raised p-8">{children}</div>
      </div>
    </div>
  );
}
