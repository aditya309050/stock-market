"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { runDMAScan, type DMAScanResponse, type DMAScanItem } from "@/lib/api";

const FILTER_OPTIONS = [
  { id: "ALL", label: "⚡ All Setups" },
  { id: "GOLDEN_CROSS", label: "🚀 Golden Cross" },
  { id: "NEAR_50_DMA", label: "🔵 Near 50 DMA" },
  { id: "NEAR_200_DMA", label: "🟣 Near 200 DMA" },
  { id: "CONFLUENCE", label: "🎯 Confluence Setups" },
  { id: "BREAKOUT_WATCH", label: "💥 Breakout Watch" },
];

export default function DMAScreenerPage() {
  const [filter, setFilter] = useState("ALL");
  const [index, setIndex] = useState("NIFTY 500");
  const [data, setData] = useState<DMAScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScan = () => {
    setLoading(true);
    setError(null);
    runDMAScan(index, filter)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || "Failed to run DMA scan");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchScan();
  }, [filter, index]);

  const getScoreBadge = (score: number) => {
    if (score >= 85) {
      return (
        <span className="px-2.5 py-1 bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold rounded-full">
          {score.toFixed(0)} / 100 🟢 STRONG SETUP
        </span>
      );
    }
    if (score >= 70) {
      return (
        <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-800 text-blue-400 text-xs font-bold rounded-full">
          {score.toFixed(0)} / 100 🔵 SOLID SETUP
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 bg-amber-950/80 border border-amber-800 text-amber-400 text-xs font-bold rounded-full">
        {score.toFixed(0)} / 100 🟡 WATCHLIST
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🔥 Real-Time DMA &amp; S/R Screener</span>
              <span className="px-2.5 py-0.5 text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full font-normal">
                LIVE
              </span>
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm mt-1">
              Broker API market data · 200+ candles · Dynamic Support &amp; Resistance · Confluence Scoring
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={index}
              onChange={(e) => setIndex(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-white rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="NIFTY 500">NIFTY 500 Universe</option>
              <option value="NIFTY 100">NIFTY 100 Universe</option>
              <option value="NIFTY 50">NIFTY 50 Universe</option>
            </select>

            <button
              onClick={fetchScan}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors shrink-0"
            >
              {loading ? "Scanning Universe..." : "Refresh Scanner"}
            </button>
          </div>
        </div>

        {/* Setup Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all ${
                filter === f.id
                  ? "bg-blue-600 border-blue-500 text-white shadow-md scale-105"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-zinc-400 text-sm">Processing real market OHLC &amp; Support/Resistance levels…</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-2xl text-center">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
              <span>
                Scanned <strong>{data.scanned}</strong> liquid NSE stocks · Found <strong>{data.matched}</strong> setups
              </span>
              <span>Sorted by Setup Score</span>
            </div>

            {data.results.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-sm">
                No stocks matched the selected setup filter right now. Try switching to &quot;⚡ All Setups&quot;.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.results.map((item) => (
                  <div
                    key={item.symbol}
                    className="bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all rounded-2xl p-5 space-y-4 shadow-lg group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/stock/${item.symbol}`}
                          className="text-xl font-extrabold text-white tracking-wide group-hover:text-blue-400 transition-colors flex items-center gap-2"
                        >
                          <span>{item.symbol}</span>
                          <span className="text-xs text-zinc-500 font-normal">→ View Detail</span>
                        </Link>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          LTP: <strong className="text-white">₹{item.price.toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="text-right">{getScoreBadge(item.score)}</div>
                    </div>

                    {/* Confluence Tags */}
                    {item.confluence_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.confluence_tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-0.5 bg-blue-950/70 border border-blue-800/60 text-blue-300 text-[11px] font-semibold rounded-full flex items-center gap-1"
                          >
                            🎯 {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Technical Metric Cards Grid */}
                    <div className="grid grid-cols-4 gap-2 bg-zinc-950/60 p-3 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-zinc-500 block">50 DMA</span>
                        <span className="font-bold text-emerald-400">₹{item.dma50.toFixed(2)}</span>
                        <span className="text-[10px] text-zinc-400 block">
                          {item.dist_50_pct >= 0 ? `+${item.dist_50_pct}%` : `${item.dist_50_pct}%`}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">200 DMA</span>
                        <span className="font-bold text-purple-400">₹{item.dma200.toFixed(2)}</span>
                        <span className="text-[10px] text-zinc-400 block">
                          {item.dist_200_pct >= 0 ? `+${item.dist_200_pct}%` : `${item.dist_200_pct}%`}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">RSI (14)</span>
                        <span className="font-bold text-white">{item.rsi}</span>
                        <span className="text-[10px] text-zinc-400 block">
                          {item.rsi >= 50 ? "Bullish" : "Neutral"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Volume</span>
                        <span className="font-bold text-amber-400">{item.volume_mult}x</span>
                        <span className="text-[10px] text-zinc-400 block">vs 20d avg</span>
                      </div>
                    </div>

                    {/* Support / Resistance Levels Bar */}
                    <div className="flex items-center justify-between text-xs pt-1 text-zinc-400 border-t border-zinc-800/80">
                      <div>
                        Support:{" "}
                        {item.nearest_support ? (
                          <span className="text-emerald-400 font-semibold">
                            {item.nearest_support.label} ₹{item.nearest_support.price} ({item.nearest_support.distance_pct}%)
                          </span>
                        ) : (
                          "None"
                        )}
                      </div>
                      <div>
                        Resistance:{" "}
                        {item.nearest_resistance ? (
                          <span className="text-red-400 font-semibold">
                            {item.nearest_resistance.label} ₹{item.nearest_resistance.price} (+{item.nearest_resistance.distance_pct}%)
                          </span>
                        ) : (
                          "None"
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
