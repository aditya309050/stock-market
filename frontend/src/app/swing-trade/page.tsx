"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";

interface SwingTradeItem {
  symbol: string;
  timeframe: string;
  last_price: number;
  volume: number;
  volume_ratio: number;
  trend: string;
  structure: string;
  swing_score: number;
  setup_category: string;
  rsi: number;
  ema20: number;
  ema50: number;
  ema200: number;
  nearest_resistance: number;
  nearest_support: number;
  dist_resistance_pct: number;
  dist_support_pct: number;
  is_breakout: boolean;
  is_hh_hl: boolean;
  tags: string[];
}

interface SwingTradeScanResponse {
  scanned: number;
  matched: number;
  breakout_candidates: SwingTradeItem[];
  pullback_setups: SwingTradeItem[];
  near_resistance: SwingTradeItem[];
  results: SwingTradeItem[];
}

const UNIVERSE_OPTIONS = ["NIFTY 500", "NSE ALL", "NIFTY 200", "NIFTY 100", "LIQUID"];
const TIMEFRAME_OPTIONS = ["15m", "5m", "30m", "1h", "1d"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export default function SwingTradePage() {
  const [universe, setUniverse] = useState("NIFTY 500");
  const [timeframe, setTimeframe] = useState("15m");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SwingTradeScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/swing-trade/scan?universe=${encodeURIComponent(
          universe
        )}&timeframe=${timeframe}`
      );
      if (!res.ok) throw new Error("Failed to fetch Swing Trade Scan");
      const json = await res.json();

      setData(json);
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScan();
  }, [universe, timeframe]);

  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    if (!searchQuery.trim()) return data.results;
    const q = searchQuery.trim().toUpperCase();
    return data.results.filter(
      (item) => item.symbol.includes(q) || item.tags.some((t) => t.toUpperCase().includes(q))
    );
  }, [data, searchQuery]);

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              📈 Live Swing Trade Scanner
              {loading && (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </h1>
            <p className="text-zinc-400 mt-1 text-sm max-w-2xl">
              Real-time DhanHQ market data feed • Swing High/Low structure (HH + HL) • Multi-timeframe confirmation
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchScan}
              disabled={loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-2"
            >
              🔄 Refresh Scanner
            </button>
          </div>
        </header>

        {/* Controls Bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Market Universe
            </label>
            <select
              value={universe}
              onChange={(e) => setUniverse(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
            >
              {UNIVERSE_OPTIONS.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
            >
              {TIMEFRAME_OPTIONS.map((tf) => (
                <option key={tf}>{tf}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1 md:col-span-2">
            <label className="text-xs text-zinc-400 block mb-1.5 font-medium">
              Search Symbol (e.g. MIDHANI, RELIANCE)
            </label>
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2 text-white text-xs uppercase focus:outline-none focus:border-blue-500 placeholder-zinc-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Setup Highlight Sections */}
        {data && (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Breakout Candidates */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-emerald-400 flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>🔥 BREAKOUT CANDIDATES</span>
                <span className="text-xs bg-emerald-950/50 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/40">
                  {data.breakout_candidates.length}
                </span>
              </h2>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.breakout_candidates.slice(0, 5).map((item) => (
                  <div
                    key={item.symbol}
                    className="flex justify-between items-center bg-zinc-950/60 p-2.5 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{item.symbol}</span>
                      <span className="text-zinc-400 text-[11px]">{item.structure}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400 block">₹{item.last_price}</span>
                      <span className="text-zinc-500 text-[10px]">Score {item.swing_score}</span>
                    </div>
                  </div>
                ))}
                {data.breakout_candidates.length === 0 && (
                  <p className="text-xs text-zinc-500 py-4 text-center">No breakout candidates</p>
                )}
              </div>
            </div>

            {/* Pullback Setups */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-blue-400 flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>🟢 PULLBACK SETUPS</span>
                <span className="text-xs bg-blue-950/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-800/40">
                  {data.pullback_setups.length}
                </span>
              </h2>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.pullback_setups.slice(0, 5).map((item) => (
                  <div
                    key={item.symbol}
                    className="flex justify-between items-center bg-zinc-950/60 p-2.5 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{item.symbol}</span>
                      <span className="text-zinc-400 text-[11px]">Near Support</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-blue-400 block">₹{item.last_price}</span>
                      <span className="text-zinc-500 text-[10px]">Score {item.swing_score}</span>
                    </div>
                  </div>
                ))}
                {data.pullback_setups.length === 0 && (
                  <p className="text-xs text-zinc-500 py-4 text-center">No pullback setups</p>
                )}
              </div>
            </div>

            {/* Near Resistance */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-amber-400 flex items-center justify-between border-b border-zinc-800 pb-2">
                <span>🟠 NEAR RESISTANCE</span>
                <span className="text-xs bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800/40">
                  {data.near_resistance.length}
                </span>
              </h2>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.near_resistance.slice(0, 5).map((item) => (
                  <div
                    key={item.symbol}
                    className="flex justify-between items-center bg-zinc-950/60 p-2.5 rounded-xl text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{item.symbol}</span>
                      <span className="text-zinc-400 text-[11px]">{item.dist_resistance_pct}% to Res</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-400 block">₹{item.last_price}</span>
                      <span className="text-zinc-500 text-[10px]">Score {item.swing_score}</span>
                    </div>
                  </div>
                ))}
                {data.near_resistance.length === 0 && (
                  <p className="text-xs text-zinc-500 py-4 text-center">No near resistance setups</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Results Table */}
        <div className="bg-[#1c1c1c] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
            <span>
              Scanned <strong>{data?.scanned || 0}</strong> stocks • Showing top{" "}
              <strong>{filteredResults.length}</strong> swing candidates
            </span>
            <span>Timeframe: <strong>{timeframe}</strong></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="text-[11px] text-zinc-400 bg-zinc-900/60 border-b border-zinc-800 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Stock</th>
                  <th className="px-5 py-3.5">CMP (₹)</th>
                  <th className="px-5 py-3.5">Structure</th>
                  <th className="px-5 py-3.5">Trend</th>
                  <th className="px-5 py-3.5">Vol Ratio</th>
                  <th className="px-5 py-3.5">RSI</th>
                  <th className="px-5 py-3.5">Dist to Res</th>
                  <th className="px-5 py-3.5">Dist to Sup</th>
                  <th className="px-5 py-3.5">Setup Category</th>
                  <th className="px-5 py-3.5">Swing Score</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        Scanning {universe} on {timeframe} timeframe...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                      No swing setups match your criteria right now.
                    </td>
                  </tr>
                )}
                {filteredResults.map((item, i) => (
                  <tr
                    key={item.symbol}
                    className={`border-b border-zinc-800/40 hover:bg-zinc-800/40 transition-colors ${
                      i % 2 === 0 ? "" : "bg-zinc-900/20"
                    }`}
                  >
                    <td className="px-5 py-3.5 font-bold text-white">
                      <Link
                        href={`/stock/${item.symbol}`}
                        className="hover:text-blue-400 underline-offset-2"
                      >
                        {item.symbol}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-zinc-200">
                      ₹{item.last_price}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.is_hh_hl
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.structure}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">{item.trend}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          item.volume_ratio >= 1.5
                            ? "text-emerald-400 font-bold"
                            : "text-zinc-400"
                        }
                      >
                        {item.volume_ratio}x
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-300">{item.rsi}</td>
                    <td className="px-5 py-3.5 text-amber-400">
                      {item.dist_resistance_pct}%
                    </td>
                    <td className="px-5 py-3.5 text-blue-400">
                      {item.dist_support_pct}%
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.setup_category === "BREAKOUT"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : item.setup_category === "PULLBACK"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                            : item.setup_category === "NEAR RESISTANCE"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.setup_category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.swing_score >= 80
                                ? "bg-emerald-500"
                                : item.swing_score >= 65
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${item.swing_score}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-white">{item.swing_score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
