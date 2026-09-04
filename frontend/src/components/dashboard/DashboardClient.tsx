"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import { useWatchlist, useWatchlistMutations } from "@/hooks/queries";

interface IntradayLevels {
  entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_reward: string;
}

interface IntradayStockItem {
  symbol: string;
  company_name: string;
  last_price: number;
  change_pct: number;
  day_high: number;
  day_low: number;
  day_open: number;
  vwap: number;
  dist_from_vwap_pct: number;
  vwap_signal: string;
  volume: number;
  volume_ratio: number;
  rsi: number;
  supertrend_bull: boolean;
  ema20: number;
  ema50: number;
  setup_category: string;
  intraday_score: number;
  confluence_tags: string[];
  levels: IntradayLevels;
}

interface IntradayScanResponse {
  index: string;
  timeframe: string;
  scanned: number;
  matched: number;
  summary: Record<string, number>;
  results: IntradayStockItem[];
}

interface IntradayOverviewResponse {
  market_sentiment: string;
  session_status: string;
  advances: number;
  declines: number;
  top_gainers: Array<{ symbol: string; last_price: number; change_pct: number; volume: number }>;
  top_losers: Array<{ symbol: string; last_price: number; change_pct: number; volume: number }>;
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const STRATEGY_FILTERS = [
  { id: "ALL", label: "⚡ All Setups", icon: "⚡" },
  { id: "VWAP_BULLISH", label: "Above VWAP", icon: "🟢" },
  { id: "VOLUME_SURGE", label: "Volume Surge", icon: "🚀" },
  { id: "ORB_BREAKOUT", label: "Day High / ORB", icon: "🎯" },
  { id: "MOMENTUM_RSI", label: "RSI Momentum", icon: "📈" },
  { id: "SUPPORT_BOUNCE", label: "Support Bounce", icon: "🛡️" },
  { id: "SHORT_WATCH", label: "Short / Breakdown", icon: "🔻" },
];

const UNIVERSE_OPTIONS = ["NIFTY 50", "NIFTY 100", "NIFTY 500", "LIQUID"];
const TIMEFRAME_OPTIONS = ["5m", "15m", "30m", "1h"];

export function DashboardClient() {
  const [universe, setUniverse] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("15m");
  const [strategy, setStrategy] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newSymbolInput, setNewSymbolInput] = useState("");

  const [scanData, setScanData] = useState<IntradayScanResponse | null>(null);
  const [overviewData, setOverviewData] = useState<IntradayOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [selectedStock, setSelectedStock] = useState<IntradayStockItem | null>(null);

  // Watchlist integration
  const watchlist = useWatchlist();
  const { add, remove } = useWatchlistMutations();

  const watchlistSymbols = useMemo(() => {
    return new Set(watchlist.data?.map((w) => w.symbol.toUpperCase()) ?? []);
  }, [watchlist.data]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewRes, scanRes] = await Promise.all([
        fetch(`${API_BASE}/intraday/overview?index=${encodeURIComponent(universe)}`).catch(() => null),
        fetch(
          `${API_BASE}/intraday/scan?index=${encodeURIComponent(
            universe
          )}&timeframe=${timeframe}&strategy=${strategy}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ""}`
        ).catch(() => null),
      ]);

      if (overviewRes && overviewRes.ok) {
        const ovJson = await overviewRes.json();
        setOverviewData(ovJson);
      }

      if (scanRes && scanRes.ok) {
        const scJson = await scanRes.json();
        setScanData(scJson);
        if (scJson.results && scJson.results.length > 0 && !selectedStock) {
          setSelectedStock(scJson.results[0]);
        }
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [universe, timeframe, strategy]);

  // Auto-refresh interval (every 30s during trading hours)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, universe, timeframe, strategy, searchQuery]);

  const filteredResults = useMemo(() => {
    if (!scanData?.results) return [];
    if (!searchQuery.trim()) return scanData.results;
    const q = searchQuery.toUpperCase().trim();
    return scanData.results.filter(
      (item) => item.symbol.toUpperCase().includes(q) || item.company_name.toUpperCase().includes(q)
    );
  }, [scanData, searchQuery]);

  const isMarketLive = overviewData?.session_status === "LIVE_OPEN";
  const sessionLabel =
    overviewData?.session_status === "LIVE_OPEN"
      ? "LIVE MARKET (09:15 - 15:30 IST)"
      : overviewData?.session_status === "PRE_OPEN"
      ? "PRE-OPEN SESSION"
      : "MARKET CLOSED / EOD FEED";

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[1550px] mx-auto space-y-6">
        {/* Top Ticker / Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 backdrop-blur-md rounded-2xl p-5 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {isMarketLive ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-zinc-500"></span>
                )}
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                ⚡ Intraday Trading Hub
              </h1>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                  isMarketLive
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {sessionLabel}
              </span>
            </div>
            <p className="text-xs md:text-sm text-zinc-400">
              Live VWAP tracking · High-volume breakouts · Opening range momentum · Risk/Reward levels
            </p>
          </div>

          {/* Controls: Refresh, Timer, Universe */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
              <span className="text-zinc-500 px-2 font-medium">Universe:</span>
              {UNIVERSE_OPTIONS.map((u) => (
                <button
                  key={u}
                  onClick={() => setUniverse(u)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    universe === u
                      ? "bg-blue-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1 text-xs">
              <span className="text-zinc-500 px-2 font-medium">Candle:</span>
              {TIMEFRAME_OPTIONS.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                    timeframe === tf
                      ? "bg-emerald-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-colors ${
                autoRefresh
                  ? "bg-zinc-800 text-emerald-400 border-emerald-500/30"
                  : "bg-zinc-950 text-zinc-500 border-zinc-800"
              }`}
              title="Toggle 30s auto-refresh"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`}></span>
              {autoRefresh ? "Auto 30s" : "Auto Off"}
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 transition-all shadow"
            >
              {loading ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              ) : (
                "↻ Refresh"
              )}
            </button>
          </div>
        </div>

        {/* Market Breadth & Live Movers Pulse */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider">Market Sentiment</span>
              <span className="text-[10px] text-zinc-500">{lastUpdated || "Syncing"}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-xl font-bold ${
                  overviewData?.market_sentiment.includes("BULLISH")
                    ? "text-emerald-400"
                    : overviewData?.market_sentiment.includes("BEARISH")
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {overviewData?.market_sentiment.replace("_", " ") || "MODERATE BULLISH"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800">
              <span className="text-emerald-400">▲ {overviewData?.advances ?? 28} Advances</span>
              <span className="text-rose-400">▼ {overviewData?.declines ?? 22} Declines</span>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 md:col-span-2">
            <div className="flex justify-between items-center text-xs text-zinc-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Top Intraday Gainers</span>
              <span className="text-[11px] text-zinc-500">Live Movers</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overviewData?.top_gainers?.slice(0, 5).map((g) => (
                <div
                  key={g.symbol}
                  onClick={() => setSearchQuery(g.symbol)}
                  className="cursor-pointer bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-emerald-500/50 rounded-xl px-3 py-1.5 transition-all text-xs flex items-center gap-2"
                >
                  <span className="font-bold text-white">{g.symbol}</span>
                  <span className="text-zinc-400">₹{g.last_price.toFixed(1)}</span>
                  <span className="text-emerald-400 font-semibold">+{g.change_pct.toFixed(2)}%</span>
                </div>
              ))}
              {(!overviewData?.top_gainers || overviewData.top_gainers.length === 0) && (
                <p className="text-xs text-zinc-500">Fetching live index movers…</p>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4">
            <div className="flex justify-between items-center text-xs text-zinc-400 mb-2">
              <span className="font-semibold uppercase tracking-wider">Top Intraday Losers</span>
              <span className="text-[11px] text-zinc-500">Breakdown Watch</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {overviewData?.top_losers?.slice(0, 3).map((l) => (
                <div
                  key={l.symbol}
                  onClick={() => setSearchQuery(l.symbol)}
                  className="cursor-pointer bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800/80 hover:border-rose-500/50 rounded-xl px-2.5 py-1 transition-all text-xs flex items-center gap-1.5"
                >
                  <span className="font-bold text-white">{l.symbol}</span>
                  <span className="text-rose-400 font-semibold">{l.change_pct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap gap-1.5 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800">
            {STRATEGY_FILTERS.map((s) => {
              const count =
                s.id === "ALL"
                  ? scanData?.matched ?? 0
                  : scanData?.summary?.[s.id] ?? 0;

              return (
                <button
                  key={s.id}
                  onClick={() => setStrategy(s.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    strategy === s.id
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {count > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${
                        strategy === s.id ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol (e.g. RELIANCE)..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Content Layout: Stock Cards & Detailed Trade Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Intraday Candidates List (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span>
                Found <strong className="text-white">{filteredResults.length}</strong> intraday opportunities in{" "}
                <strong className="text-blue-400">{universe}</strong> ({timeframe})
              </span>
              <span className="text-[11px] text-zinc-500">Sorted by Intraday Setup Score</span>
            </div>

            {loading && !scanData ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
                <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
                <p className="text-sm text-zinc-300 font-medium">Scanning live intraday candles & VWAP...</p>
                <p className="text-xs text-zinc-500 mt-1">Calculating momentum, volume burst, and trade levels</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center space-y-3">
                <p className="text-base text-zinc-300 font-medium">No setups matching this filter right now</p>
                <p className="text-xs text-zinc-500">
                  Try switching the strategy filter to <strong>All Setups</strong> or changing the universe to <strong>NIFTY 100</strong>.
                </p>
                <button
                  onClick={() => {
                    setStrategy("ALL");
                    setSearchQuery("");
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-4 py-2 rounded-xl text-white transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredResults.map((item) => {
                  const isSelected = selectedStock?.symbol === item.symbol;
                  const isWatchlisted = watchlistSymbols.has(item.symbol.toUpperCase());
                  const isPositive = item.change_pct >= 0;

                  return (
                    <div
                      key={item.symbol}
                      onClick={() => setSelectedStock(item)}
                      className={`cursor-pointer rounded-2xl p-5 border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? "bg-zinc-900 border-blue-500 ring-1 ring-blue-500 shadow-xl shadow-blue-500/10"
                          : "bg-zinc-900/80 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-md"
                      }`}
                    >
                      {/* Top Row: Symbol, Score, Watchlist Button */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-lg text-white tracking-tight">
                                {item.symbol}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                  isPositive
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {item.change_pct.toFixed(2)}%
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate max-w-[200px] mt-0.5">
                              {item.company_name}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Setup Score Badge */}
                            <div
                              className={`text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 border ${
                                item.intraday_score >= 75
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : item.intraday_score >= 55
                                  ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
                              }`}
                              title="Intraday Opportunity Score (0-100)"
                            >
                              <span>★</span>
                              <span>{item.intraday_score}</span>
                            </div>

                            {/* Watchlist Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isWatchlisted) {
                                  const itemFound = watchlist.data?.find(
                                    (w) => w.symbol.toUpperCase() === item.symbol.toUpperCase()
                                  );
                                  if (itemFound) remove.mutate(itemFound.id);
                                } else {
                                  add.mutate(item.symbol.toUpperCase());
                                }
                              }}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isWatchlisted
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white"
                              }`}
                              title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                            >
                              {isWatchlisted ? "★" : "☆"}
                            </button>
                          </div>
                        </div>

                        {/* Price & VWAP Info */}
                        <div className="mt-4 grid grid-cols-2 gap-2 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase">LTP</span>
                            <p className="text-base font-bold text-white">₹{item.last_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase">VWAP</span>
                            <div className="flex items-center gap-1.5">
                              <p className="text-base font-semibold text-zinc-200">₹{item.vwap.toFixed(2)}</p>
                              <span
                                className={`text-[10px] font-bold ${
                                  item.dist_from_vwap_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                ({item.dist_from_vwap_pct >= 0 ? "+" : ""}
                                {item.dist_from_vwap_pct}%)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Intraday Metrics Chips */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="bg-zinc-800/60 py-1.5 px-1 rounded-lg">
                            <span className="text-[10px] text-zinc-400 block">Volume</span>
                            <span className="font-semibold text-zinc-200">
                              {item.volume_ratio >= 1.8 ? "🔥 " : ""}
                              {item.volume_ratio}x
                            </span>
                          </div>
                          <div className="bg-zinc-800/60 py-1.5 px-1 rounded-lg">
                            <span className="text-[10px] text-zinc-400 block">RSI(14)</span>
                            <span
                              className={`font-semibold ${
                                item.rsi >= 60 ? "text-emerald-400" : item.rsi <= 40 ? "text-rose-400" : "text-zinc-200"
                              }`}
                            >
                              {item.rsi}
                            </span>
                          </div>
                          <div className="bg-zinc-800/60 py-1.5 px-1 rounded-lg">
                            <span className="text-[10px] text-zinc-400 block">Supertrend</span>
                            <span
                              className={`font-semibold text-[11px] ${
                                item.supertrend_bull ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {item.supertrend_bull ? "Bullish" : "Bearish"}
                            </span>
                          </div>
                        </div>

                        {/* Confluence Tags */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {item.confluence_tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/50"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Trade Levels Glance */}
                      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <div className="text-zinc-400">
                          SL: <span className="text-rose-400 font-semibold">₹{item.levels.stop_loss}</span>
                        </div>
                        <div className="text-zinc-400">
                          Target: <span className="text-emerald-400 font-semibold">₹{item.levels.target_1}</span>
                        </div>
                        <div className="text-blue-400 font-semibold text-[11px]">
                          R:R {item.levels.risk_reward}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Active Setup Inspector & Watchlist Manager (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Trade Plan / Levels Card */}
            {selectedStock ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 sticky top-6 shadow-xl">
                <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                      Active Setup Inspector
                    </span>
                    <h2 className="text-2xl font-black text-white mt-0.5">{selectedStock.symbol}</h2>
                    <p className="text-xs text-zinc-400">{selectedStock.company_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">₹{selectedStock.last_price.toFixed(2)}</p>
                    <p
                      className={`text-xs font-semibold ${
                        selectedStock.change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedStock.change_pct >= 0 ? "+" : ""}
                      {selectedStock.change_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Suggested Trade Execution Plan */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    🎯 Intraday Trade Plan
                  </span>
                  <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Suggested Entry</span>
                      <span className="font-bold text-white">₹{selectedStock.levels.entry.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Stop Loss</span>
                      <span className="font-bold text-rose-400">₹{selectedStock.levels.stop_loss.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Target 1 (1.5x ATR)</span>
                      <span className="font-bold text-emerald-400">₹{selectedStock.levels.target_1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Target 2 (Runner)</span>
                      <span className="font-bold text-emerald-300">₹{selectedStock.levels.target_2.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Risk : Reward</span>
                      <span className="font-bold text-blue-400">{selectedStock.levels.risk_reward}</span>
                    </div>
                  </div>
                </div>

                {/* Key Intraday Levels */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    📊 Key Technical Pivots
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Day High</span>
                      <span className="font-bold text-emerald-400">₹{selectedStock.day_high.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">Day Low</span>
                      <span className="font-bold text-rose-400">₹{selectedStock.day_low.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">20 EMA</span>
                      <span className="font-bold text-zinc-200">₹{selectedStock.ema20.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block">50 EMA</span>
                      <span className="font-bold text-zinc-200">₹{selectedStock.ema50.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Action Link */}
                <div className="pt-2">
                  <Link
                    href={`/stock?symbol=${selectedStock.symbol}`}
                    className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors shadow"
                  >
                    Open Full Stock Analytics & Chart →
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Quick Watchlist Box */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>★</span> My Live Watchlist
                </h3>
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">
                  {watchlist.data?.length ?? 0}
                </span>
              </div>

              {/* Add Symbol Input */}
              <div className="flex gap-2">
                <input
                  value={newSymbolInput}
                  onChange={(e) => setNewSymbolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSymbolInput.trim()) {
                      add.mutate(newSymbolInput.trim().toUpperCase());
                      setNewSymbolInput("");
                    }
                  }}
                  placeholder="Add stock (e.g. INFY)..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    if (newSymbolInput.trim()) {
                      add.mutate(newSymbolInput.trim().toUpperCase());
                      setNewSymbolInput("");
                    }
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-xs px-3 py-2 rounded-xl text-white transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Watchlist Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {watchlist.data?.map((w) => (
                  <div
                    key={w.id}
                    className="group bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer"
                    onClick={() => setSearchQuery(w.symbol)}
                  >
                    <span className="font-semibold text-white">{w.symbol}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(w.id);
                      }}
                      className="text-zinc-600 hover:text-rose-400 font-bold text-xs"
                      title="Remove from watchlist"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(!watchlist.data || watchlist.data.length === 0) && (
                  <p className="text-xs text-zinc-500">Your watchlist is empty. Add symbols above or star candidates from the left!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
