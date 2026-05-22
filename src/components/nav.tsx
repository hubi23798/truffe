"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { TruffleMark } from "@/components/truffle-mark";
import {
  Home, TrendingUp, ArrowLeftRight, Target, BarChart2,
  MessageCircle, Settings, HelpCircle, Mail, RefreshCw, Tag, Lightbulb, LogOut,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const PRIMARY_LINKS: NavItem[] = [
  { href: "/",                   label: "Home",         icon: Home },
  { href: "/wealth",             label: "Wealth",       icon: TrendingUp },
  { href: "/transactions",       label: "Transactions", icon: ArrowLeftRight },
  { href: "/transactions/inbox", label: "Inbox",        icon: Mail },
  { href: "/recurring",          label: "Recurring",    icon: RefreshCw },
  { href: "/goals",              label: "Goals",        icon: Target },
  { href: "/budget",             label: "Budget",       icon: BarChart2 },
  { href: "/advisor",            label: "Advisor",      icon: MessageCircle },
  { href: "/categories",         label: "Categories",   icon: Tag },
  { href: "/insights",           label: "Insights",     icon: Lightbulb },
];

const UTILITY_LINKS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help",     label: "Help",     icon: HelpCircle },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as Route}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        "border-l-[3px] pl-[9px]",
        isActive
          ? "bg-[#3A2414] text-[#F7F4EE] border-[#C9A84C]"
          : "text-[#C4B8A8] border-transparent hover:bg-[#3A2414] hover:text-[#F7F4EE]",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors duration-150",
          isActive ? "text-[#C9A84C]" : "text-[#6B5040] group-hover:text-[#C4B8A8]",
        )}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SignOutItem() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        "border-l-[3px] border-transparent pl-[9px]",
        "text-[#C4B8A8] hover:bg-[#3A2414] hover:text-[#F7F4EE] disabled:opacity-50",
      )}
    >
      <LogOut
        className="h-4 w-4 shrink-0 text-[#6B5040] group-hover:text-[#C4B8A8] transition-colors duration-150"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span>{busy ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}

export function SidebarNav({ className }: { className?: string }) {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    if (href === "/transactions") {
      return (
        pathname === "/transactions" ||
        (pathname.startsWith("/transactions/") && !pathname.startsWith("/transactions/inbox"))
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={cn(
        "flex h-full w-[220px] shrink-0 flex-col",
        "bg-[#1A0D06] border-r border-[#3A2414]",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <TruffleMark size={28} small />
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: "#F7F4EE",
          }}
          aria-label="truffe.ai"
        >
          truffe<span style={{ color: "#C9A84C" }}>.ai</span>
        </span>
      </div>

      {/* Primary nav */}
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1"
        aria-label="Main navigation"
      >
        {PRIMARY_LINKS.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
      </nav>

      {/* Utility + sign out */}
      <div
        className="flex flex-col gap-0.5 border-t border-[#3A2414] px-2 py-3"
        aria-label="Utility navigation"
      >
        {UTILITY_LINKS.map((item) => (
          <NavLink key={item.href} item={item} isActive={isActive(item.href)} />
        ))}
        <SignOutItem />
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--brand-paper)" }}>
      <SidebarNav />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
