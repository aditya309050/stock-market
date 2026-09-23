"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { href: "/fo-options", label: "F&O Options", desc: "Live Greeks & Max Pain" },
  { href: "/screener", label: "F&O Stocks", desc: "Breakouts & Volume" },
  { href: "/dashboard", label: "Intraday Hub", desc: "Live Day Scans & ORB" },
  { href: "/dashboard/golden-cross", label: "Golden Cross", desc: "50/200 DMA Trend Setups" },
  { href: "/swing-trade", label: "Swing Trade", desc: "Multi-day momentum" },
  { href: "/dma-screener", label: "DMA & S/R", desc: "Confluence & Key Levels" },
  { href: "/sector-analysis", label: "Sector Analysis", desc: "Sectoral Heatmaps" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/screener"
            className="flex items-center gap-1.5 cursor-pointer group select-none"
          >
            <span className="text-xl sm:text-2xl font-black font-serif tracking-tight text-white flex items-center gap-1">
              screener<span className="text-[#c4b5fd] text-base animate-pulse">✦</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex gap-5 text-sm font-medium">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`py-1 transition-all ${
                  pathname === href
                    ? "text-white font-bold border-b-2 border-[#c4b5fd]"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section: Desktop Logout & Mobile Hamburger Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={logout}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors"
          >
            Logout
          </button>

          {/* ── Mobile Hamburger Toggle Button ──────────────────────────────── */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 focus:outline-none transition-all flex items-center justify-center cursor-pointer"
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              // Close "X" Icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger Icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Mobile Navigation Drawer Menu ───────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between animate-fadeIn">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-3 pb-2">
              Market Modules &amp; Screeners
            </div>
            {NAV.map(({ href, label, desc }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-[#c4b5fd]/15 border border-[#c4b5fd]/30 text-white font-bold shadow-md"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{label}</span>
                    <span className="text-[11px] text-zinc-500 font-normal">{desc}</span>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-[#c4b5fd] shadow-sm shadow-[#c4b5fd]" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Bottom Mobile Drawer Footer */}
          <div className="pt-6 border-t border-zinc-800/80 mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium">NSE Live Connected</span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
