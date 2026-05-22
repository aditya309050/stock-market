"use client";

import { useState } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  useDashboard,
  useWatchlist,
  useWatchlistMutations,
} from "@/hooks/queries";
import { useNSEMarketOverview } from "@/hooks/nse-queries";

export function DashboardClient() {
  const [symbol, setSymbol] = useState("");
  const dashboard = useDashboard();
  const overview = useNSEMarketOverview("NIFTY 50");
  const watchlist = useWatchlist();
  const { add } = useWatchlistMutations();

  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold">NSE Dashboard</h1>
            <p className="text-zinc-400 mt-1">Live movers · Watchlist · Quick links</p>
          </div>
          <Link
            href="/screener"
            className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium"
          >
            Open Screener
          </Link>
        </header>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase">Watchlist size</p>
            <p className="text-3xl font-bold mt-1">{watchlist.data?.length ?? 0}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase">Top gainer</p>
            <p className="text-3xl font-bold mt-1 text-emerald-400">
              {overview.data?.gainers[0]?.symbol ?? "—"}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase">Alerts</p>
            <p className="text-3xl font-bold mt-1">
              {dashboard.data?.triggered_alerts_count ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="font-semibold mb-3">Add to watchlist</h2>
          <div className="flex gap-2">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. TCS"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm uppercase"
            />
            <button
              onClick={() => {
                if (symbol.trim()) add.mutate(symbol.trim().toUpperCase());
              }}
              className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-lg text-sm"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {watchlist.data?.map((w) => (
              <span
                key={w.id}
                className="text-sm bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1"
              >
                {w.symbol}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
