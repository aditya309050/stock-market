"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { href: "/fo-options", label: "📊 F&O Options" },
  { href: "/screener", label: "🔥 F&O Stocks" },
  { href: "/dashboard", label: "⚡ Intraday Hub" },
  { href: "/dashboard/golden-cross", label: "🔥 Golden Cross" },
  { href: "/swing-trade", label: "📈 Swing Trade" },
  { href: "/dma-screener", label: "🛡️ DMA & S/R" },
  { href: "/sector-analysis", label: "📊 Sector Analysis" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/screener"
            className="flex items-center gap-2.5 group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-blue-600 to-indigo-600 text-white font-black text-xs shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              F&amp;O
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-white group-hover:text-zinc-200 flex items-center gap-1.5 leading-none">
                <span>F&amp;O</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  PRO
                </span>
              </span>
              <span className="text-[9px] text-zinc-400 tracking-wider uppercase font-medium mt-0.5">
                Breakout &amp; Screener
              </span>
            </div>
          </Link>
          <nav className="hidden lg:flex gap-4 text-sm font-medium">
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
