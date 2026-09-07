"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Users,
  Calendar,
  Library,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/ui/Logo";

export type AdminNavProps = {
  displayName: string;
  avatar: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/schedule", label: "Schedule", icon: Calendar },
  { href: "/admin/curriculum", label: "Curriculum", icon: Library },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150",
              active ? "bg-accent-soft text-accent-ink" : "text-ink-muted hover:bg-stone-100 hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountRow({ displayName, avatar }: AdminNavProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
      <Avatar emoji={avatar} name={displayName} size="sm" />
      <span className="flex-1 truncate text-sm font-medium text-ink">{displayName}</span>
      <form action="/logout" method="post">
        <button
          type="submit"
          aria-label="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-stone-100 hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Sidebar on ≥lg, collapses to a top bar with a slide-in menu below that. */
export function AdminNav({ displayName, avatar }: AdminNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Sidebar (lg and up) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-line lg:bg-surface-raised lg:px-4 lg:py-6">
        <div className="space-y-6">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-2 text-base font-semibold tracking-tight text-brand-navy"
          >
            <LogoMark size={30} />
            Oakman Academy
          </Link>
          <NavLinks pathname={pathname} />
        </div>
        <AccountRow displayName={displayName} avatar={avatar} />
      </aside>

      {/* Top bar (below lg) */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur">
        <Link href="/admin" className="flex items-center gap-2 text-base font-semibold tracking-tight text-brand-navy">
          <LogoMark size={26} />
          Oakman Academy
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-150 hover:bg-stone-100"
        >
          <Menu className="h-5 w-5 text-ink" />
        </button>
      </header>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} side="right" title="Menu">
        <div className="space-y-6">
          <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          <AccountRow displayName={displayName} avatar={avatar} />
        </div>
      </Sheet>
    </>
  );
}
