"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import * as api from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { NSEScanResponse } from "@/lib/nse-types";
import { useNSESmartScan, useNSEMarketOverview } from "@/hooks/nse-queries";
import { useAuthStore } from "@/stores/auth-store";

const INDEX_OPTIONS = [
  "NIFTY 50",
  "NIFTY 100",
  "NIFTY 500",
  "NIFTY TOTAL MARKET",
] as const;

function signalColor(signal?: string) {
  if (!signal) return "text-zinc-400";
  if (signal.includes("Strong") || signal.includes("buy")) return "text-emerald-400";
  if (signal === "Watch") return "text-amber-400";
  if (signal === "Avoid") return "text-red-400";
  return "text-zinc-300";
}

export default function ScreenerPage() {
  const [index, setIndex] = useState<string>("NIFTY 500");
  const [symbol, setSymbol] = useState("");
  const [results, setResults] = useState<NSEScanResponse | null>(null);

  const overview = useNSEMarketOverview(index);
  const smartScan = useNSESmartScan();
  const token = useAuthStore((s) => s.token);

  const runScan = () => {
    smartScan.mutate(
      { index, symbol: symbol.trim() || undefined },
      { onSuccess: setResults }
    );
  };

  const err =
    smartScan.error instanceof ApiError ? smartScan.error.message : "";

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <header className="text-center md:text-left">
          <h1 className="text-3xl font-bold">AI Swing Screener</h1>
          <p className="text-zinc-400 mt-2 text-sm max-w-xl">
            Scans every stock with RSI, MACD, EMA, VWAP, Bollinger, Supertrend,
            ADX, volume &amp; swing breakouts — then AI ranks the best swing setups.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-emerald-400 font-semibold mb-2">Top gainers</h2>
            <ul className="space-y-1">
              {overview.data?.gainers.slice(0, 5).map((g) => (
                <li key={g.symbol} className="flex justify-between">
                  <span>{g.symbol}</span>
                  <span className="text-emerald-400">+{g.change_pct?.toFixed(2)}%</span>
                </li>
              )) ?? <li className="text-zinc-500">Loading…</li>}
            </ul>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-red-400 font-semibold mb-2">Top losers</h2>
            <ul className="space-y-1">
              {overview.data?.losers.slice(0, 5).map((l) => (
                <li key={l.symbol} className="flex justify-between">
                  <span>{l.symbol}</span>
                  <span className="text-red-400">{l.change_pct?.toFixed(2)}%</span>
                </li>
              )) ?? <li className="text-zinc-500">Loading…</li>}
            </ul>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Market</label>
              <select
                value={index}
                onChange={(e) => setIndex(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm"
              >
                {INDEX_OPTIONS.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">
                One stock (optional)
              </label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. RELIANCE"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm uppercase"
              />
            </div>
          </div>

          <button
            onClick={runScan}
            disabled={smartScan.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-base transition-colors"
          >
            {smartScan.isPending
              ? `Scanning ${symbol || index} with AI… (may take a few minutes)`
              : "Find swing picks"}
          </button>

          <p className="text-xs text-zinc-500 text-center">
            Uses all indicators on 1d · 1h · 2h charts. Shows top 30 swing setups.
          </p>
        </div>

        {err && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
            {err}
          </p>
        )}

        {results?.summary && (
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-5">
            <h2 className="text-blue-300 font-semibold mb-2">AI market outlook</h2>
            <div className="text-sm text-blue-100/90 whitespace-pre-wrap leading-relaxed">
              {results.summary}
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              {results.matched} swing setups from {results.scanned} stocks · showing top{" "}
              {results.results.length}
            </p>

            {results.results.length === 0 ? (
              <p className="text-zinc-500 text-sm bg-zinc-900 rounded-xl p-6 text-center">
                No strong swing setups right now. Try again later.
              </p>
            ) : (
              results.results.map((r) => (
                <div
                  key={r.symbol}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-lg font-bold">{r.symbol}</span>
                      <span
                        className={`ml-3 text-sm font-medium ${signalColor(r.swing_signal)}`}
                      >
                        {r.swing_signal}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {r.ai_score?.toFixed(0)}
                      </div>
                      <div className="text-xs text-zinc-500">score</div>
                    </div>
                  </div>

                  {r.swing_tags && r.swing_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.swing_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.ai_note && (
                    <p className="text-sm text-zinc-300 border-t border-zinc-800 pt-2 mt-1">
                      {r.ai_note}
                    </p>
                  )}
                </div>
              ))
            )}

            {results.scan_id && token && (
              <button
                type="button"
                onClick={() => {
                  fetch(api.exportNSEScanCsv(results.scan_id!), {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                    .then((res) => res.blob())
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `swing_scan_${results.scan_id}.csv`;
                      a.click();
                    });
                }}
                className="text-sm text-zinc-400 hover:text-white underline"
              >
                Download CSV
              </button>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
