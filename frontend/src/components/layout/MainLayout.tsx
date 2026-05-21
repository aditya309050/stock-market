import React from "react";
import Link from "next/link";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
      <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-white hover:text-zinc-300 transition-colors">
            AI Trading Pro
          </Link>
          <nav className="hidden md:flex gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/chat" className="text-zinc-400 hover:text-white transition-colors">AI Copilot</Link>
            <Link href="/strategies" className="text-zinc-400 hover:text-white transition-colors">Strategies</Link>
            <Link href="/screener" className="text-zinc-400 hover:text-white transition-colors">Screener</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded border border-emerald-800">
            PRO TIER
          </span>
          <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold">
            U
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
