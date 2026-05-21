"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ApiError } from "@/lib/api";
import {
  useDashboard,
  useWatchlist,
  useStrategies,
  usePaperBalance,
  useAISuggestion,
  useWatchlistMutations,
  useTestAlert,
} from "@/hooks/queries";
import { useUiStore } from "@/stores/ui-store";

export function DashboardClient() {
  const [newSymbol, setNewSymbol] = useState("");

  const dashboard = useDashboard();
  const watchlist = useWatchlist();
  const strategies = useStrategies();
  const paperBalance = usePaperBalance();
  const { add, remove } = useWatchlistMutations();
  const testAlert = useTestAlert();

  const firstSymbol = watchlist.data?.[0]?.symbol;
  const selectedSymbol = useUiStore((s) => s.selectedSymbol) ?? firstSymbol;
  const aiInsight = useAISuggestion(selectedSymbol);

  const activeStrategies =
    strategies.data?.filter((s) => s.is_active) ?? [];

  const error =
    dashboard.error ?? watchlist.error ?? strategies.error ?? paperBalance.error;
  const loading =
    dashboard.isLoading ||
    watchlist.isLoading ||
    strategies.isLoading ||
    paperBalance.isLoading;

  const analytics = dashboard.data;
  const pnlPct =
    analytics && analytics.total_portfolio_value > 0
      ? ((analytics.daily_pnl / analytics.total_portfolio_value) * 100).toFixed(2)
      : "0.00";

  const addSymbol = () => {
    if (!newSymbol.trim()) return;
    add.mutate(newSymbol.trim().toUpperCase(), {
      onSuccess: () => setNewSymbol(""),
    });
  };

  const errorMsg =
    error instanceof ApiError
      ? error.message
      : error
        ? "Failed to load dashboard"
        : add.error instanceof ApiError
          ? add.error.message
          : remove.error instanceof ApiError
            ? remove.error.message
            : "";

  return (
    <MainLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Market Dashboard</h1>
            <p className="text-zinc-400 mt-1">
              Data cached with React Query · UI state in Zustand
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() =>
                testAlert.mutate("Dashboard test alert", {
                  onSuccess: () => alert("Alert task dispatched"),
                })
              }
              disabled={testAlert.isPending}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            >
              Test Alert
            </button>
            <a
              href="/strategies"
              className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Build Strategy
            </a>
          </div>
        </header>

        {errorMsg && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-3">
            {errorMsg}
          </p>
        )}

        {loading ? (
          <p className="text-zinc-500">Loading dashboard…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Portfolio Value"
                value={`$${analytics?.total_portfolio_value.toLocaleString() ?? "—"}`}
              />
              <StatCard
                label="Daily P&L"
                value={`${(analytics?.daily_pnl ?? 0) >= 0 ? "+" : ""}$${analytics?.daily_pnl.toFixed(2) ?? "—"}`}
                sub={`${pnlPct}%`}
                positive={(analytics?.daily_pnl ?? 0) >= 0}
              />
              <StatCard
                label="Active Strategies"
                value={String(analytics?.active_strategies_count ?? 0)}
              />
              <StatCard
                label="Paper Balance"
                value={`$${paperBalance.data?.balance.toLocaleString() ?? "—"}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 md:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  Top Performers
                </h2>
                <ul className="mt-4 space-y-2">
                  {analytics?.top_performers.map((p) => (
                    <li
                      key={p.symbol}
                      className="flex justify-between text-sm border-b border-zinc-800/50 pb-2"
                    >
                      <span className="font-medium">{p.symbol}</span>
                      <span className="text-emerald-400">+{p.return}%</span>
                    </li>
                  )) ?? (
                    <li className="text-zinc-500 text-sm">No data</li>
                  )}
                </ul>
              </div>

              <div className="bg-gradient-to-b from-blue-900/20 to-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-medium text-blue-400">AI Suggestion</h2>
                {aiInsight.isLoading ? (
                  <p className="mt-4 text-sm text-zinc-500">Loading insight…</p>
                ) : aiInsight.data ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <p>
                      <span className="text-zinc-500">Symbol:</span> {aiInsight.data.symbol}
                    </p>
                    <p>
                      <span className="text-zinc-500">Action:</span>{" "}
                      <span className="font-semibold text-white">{aiInsight.data.action}</span>{" "}
                      ({(aiInsight.data.confidence_score * 100).toFixed(0)}% confidence)
                    </p>
                    <p className="text-zinc-300 leading-relaxed">{aiInsight.data.reasoning}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">
                    Add a symbol to your watchlist for AI insights.
                  </p>
                )}
              </div>
            </div>

            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Watchlist</h2>
                <div className="flex gap-2">
                  <input
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    placeholder="e.g. AAPL"
                    className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm uppercase"
                  />
                  <button
                    onClick={addSymbol}
                    disabled={add.isPending}
                    className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
                  >
                    {add.isPending ? "…" : "Add"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {watchlist.data?.map((w) => (
                  <span
                    key={w.id}
                    className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 text-sm cursor-pointer hover:border-zinc-600"
                    onClick={() => useUiStore.getState().setSelectedSymbol(w.symbol)}
                  >
                    {w.symbol}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(w.id);
                      }}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(!watchlist.data || watchlist.data.length === 0) && (
                  <span className="text-zinc-500 text-sm">No symbols yet</span>
                )}
              </div>
              {selectedSymbol && (
                <p className="text-xs text-zinc-500 mt-2">
                  Selected for AI: <span className="text-zinc-300">{selectedSymbol}</span>
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Active Strategies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeStrategies.map((s) => (
                  <div
                    key={s.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{s.name}</h3>
                      <div className="h-2 w-2 bg-emerald-500 rounded-full" />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                      {s.description || "No description"}
                    </p>
                  </div>
                ))}
                {activeStrategies.length === 0 && (
                  <p className="text-zinc-500 text-sm col-span-full">
                    No active strategies. Create one on the Strategies page.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && (
        <p
          className={`text-sm mt-1 ${positive ? "text-emerald-400" : "text-red-400"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
