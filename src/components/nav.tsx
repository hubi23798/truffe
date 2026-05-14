"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { LogoutButton } from "@/components/logout-button";

const links = [
  { href: "/", label: "Home" },
  { href: "/wealth", label: "Wealth" },
  { href: "/transactions/inbox", label: "Inbox" },
  { href: "/transactions", label: "Transactions" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  if (path === "/login") return null;

  return (
    <header className="border-border-subtle bg-surface sticky top-0 z-10 border-b">
      <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 py-2">
        <Link href={"/" as Route} className="mr-4 text-sm font-bold tracking-tight text-fg-default">
          piggy.ai
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
