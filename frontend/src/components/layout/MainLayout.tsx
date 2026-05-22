"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/screener", label: "NSE Screener" },
  { href: "/chat", label: "AI Copilot" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-white hover:text-zinc-300"
          >
            NSE Screener Pro
          </Link>
          <nav className="hidden md:flex gap-4 text-sm font-medium">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={
                  pathname === href
                    ? "text-white"
                    : "text-zinc-400 hover:text-white transition-colors"
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <button
          onClick={logout}
          className="text-xs text-zinc-400 hover:text-white transition-colors"
        >
          Logout
        </button>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
