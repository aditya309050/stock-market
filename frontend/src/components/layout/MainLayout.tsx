"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "AI Copilot" },
  { href: "/strategies", label: "Strategies" },
  { href: "/screener", label: "Screener" },
  { href: "/marketplace", label: "Marketplace" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { subscription, logout } = useAuth();
  const tier = subscription?.tier ?? "free";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-white hover:text-zinc-300 transition-colors"
          >
            AI Trading Pro
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
        <div className="flex items-center gap-4">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded border uppercase ${
              tier === "free"
                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                : "bg-emerald-900/40 text-emerald-400 border-emerald-800"
            }`}
          >
            {tier} tier
          </span>
          <button
            onClick={logout}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
