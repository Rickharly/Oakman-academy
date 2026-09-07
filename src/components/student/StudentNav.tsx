"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, TrendingUp, MessageCircle, LogOut, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

export type StudentNavProps = {
  displayName: string;
  avatar: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/teacher", label: "Teacher", icon: MessageCircle },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentNav({ displayName, avatar }: StudentNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Top bar (md and up) */}
      <header className="hidden md:block sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/today" className="text-base font-semibold tracking-tight text-ink">
            Family School
          </Link>

          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150",
                    active ? "bg-accent-soft text-accent-ink" : "text-ink-muted hover:bg-stone-100 hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 items-center gap-2 rounded-full pl-1 pr-3 transition-colors duration-150 hover:bg-stone-100"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Avatar emoji={avatar ?? "🙂"} size="sm" />
              <span className="text-sm font-medium text-ink">{displayName}</span>
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface-raised py-1 shadow-lg"
                >
                  <form action="/logout" method="post">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-stone-100"
                    >
                      <LogOut className="h-4 w-4 text-ink-muted" />
                      Log out
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile top bar: brand + account menu only (nav lives in the bottom tab bar) */}
      <header className="md:hidden sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/today" className="text-base font-semibold tracking-tight text-ink">
            Family School
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-stone-100"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Avatar emoji={avatar ?? "🙂"} size="sm" />
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface-raised py-1 shadow-lg"
                >
                  <p className="px-4 py-2 text-sm font-medium text-ink">{displayName}</p>
                  <form action="/logout" method="post">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-stone-100"
                    >
                      <LogOut className="h-4 w-4 text-ink-muted" />
                      Log out
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Bottom tab bar (below md) */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-11 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150",
                  active ? "text-accent" : "text-ink-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
