"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { LogoutButton } from "@/components/logout-button";
import { TruffleMark } from "@/components/truffle-mark";

const links = [
  { href: "/", label: "Home" },
  { href: "/advisor", label: "Advisor" },
  { href: "/wealth", label: "Wealth" },
  { href: "/transactions/inbox", label: "Inbox" },
  { href: "/transactions", label: "Transactions" },
  { href: "/recurring", label: "Recurring" },
  { href: "/goals", label: "Goals" },
  { href: "/budget", label: "Budget" },
  { href: "/categories", label: "Categories" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  if (path === "/login") return null;

  return (
    <header className="border-border-subtle bg-surface sticky top-0 z-10 border-b">
      <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 py-2">
        <Link href={"/" as Route} className="mr-4 flex items-center gap-2.5 group">
          <TruffleMark size={28} small />
          <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.003em", lineHeight: 1, color: "var(--color-fg-default)" }}>
            truffe<span style={{ color: "var(--brand-gold)", transition: "color 0.15s" }} className="group-hover:text-[var(--brand-forest)]">.</span>ai
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href as Route}
              className={`rounded px-2 py-1 text-sm transition-colors ${
                path === l.href || (l.href !== "/" && path.startsWith(l.href))
                  ? "text-fg-default font-medium"
                  : "text-fg-muted hover:text-fg-default"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
