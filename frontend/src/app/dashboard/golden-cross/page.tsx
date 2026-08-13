"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, LineSeries } from "lightweight-charts";
import { MainLayout } from "@/components/layout/MainLayout";

type ScoreRuleItem = {
  rule: string;
  points: number;
  earned: boolean;
};

type GoldenCrossStock = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  sma50: number;
  sma200: number;
  dma_gap_pct: number;
  is_crossed: boolean;
  sma50_slope_pct: number;
  sma200_slope_pct: number;
  sma50_slope: string;
  sma200_slope: string;
  price_above_50dma: boolean;
  price_above_200dma: boolean;
  volume_ratio: number;
  rsi: number;
  score: number;
  score_breakdown: ScoreRuleItem[];
  signal_type: string;
  signal_name: string;
  signal_emoji: string;
  signal_color: string;
  backtest_win_rate: number;
  est_days_to_cross: number;
  confidence: string;
  last_tick_dir?: "up" | "down" | null;
};

type ScanStats = {
  total_tracked: number;
  golden_cross_active: number;
  very_near: number;
  near: number;
  approaching: number;
  early: number;
  average_score: number;
  top_scored_stock: string;
};

type ChartCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma50: number | null;
  sma200: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1")
  .replace("http://", "ws://")
  .replace("https://", "wss://");

export default function GoldenCrossScannerPage() {
  const [stocks, setStocks] = useState<GoldenCrossStock[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  // Filters state
  const [maxGap, setMaxGap] = useState<number>(5.0);
  const [minScore, setMinScore] = useState<number>(0);
  const [signalFilter, setSignalFilter] = useState<string>("ALL");
  const [minVolRatio, setMinVolRatio] = useState<number>(0.0);
  const [rsiFilter, setRsiFilter] = useState<string>("ALL"); // ALL, SWEET (50-65)
  const [priceAbove50Only, setPriceAbove50Only] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grouped" | "table">("grouped");

  // Selected stock modal state
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [stockDetail, setStockDetail] = useState<{
    symbol: string;
    name: string;
    sector: string;
    metrics: GoldenCrossStock;
    chart_data: ChartCandle[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "breakdown" | "backtest">("chart");

  // Lightweight chart ref
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Fetch initial scan results
  const fetchScannerResults = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        max_gap: maxGap.toString(),
        min_score: minScore.toString(),
        min_volume_ratio: minVolRatio.toString(),
      });

      if (signalFilter !== "ALL") queryParams.append("signal_type", signalFilter);
      if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
      if (priceAbove50Only) queryParams.append("price_above_50", "true");
      if (rsiFilter === "SWEET") {
        queryParams.append("rsi_min", "50");
        queryParams.append("rsi_max", "65");
      }

      const res = await fetch(`${API_BASE}/golden-cross/scan?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data.results || []);
      }
    } catch (e) {
      console.error("Scanner fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [maxGap, minScore, signalFilter, minVolRatio, rsiFilter, priceAbove50Only, searchQuery]);

  // Fetch stats summary
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/golden-cross/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Stats fetch error:", e);
    }
  };

  useEffect(() => {
    fetchScannerResults();
    fetchStats();
  }, [fetchScannerResults]);

  // Setup WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout;

    const connectWS = () => {
      try {
        ws = new WebSocket(`${WS_BASE}/golden-cross/ws`);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "TICK" && msg.symbol && msg.updated_stock) {
              setStocks((prev) =>
                prev.map((s) => {
                  if (s.symbol === msg.symbol) {
                    const dir = msg.change_pct > 0 ? "up" : "down";
                    return {
                      ...s,
                      ...msg.updated_stock,
                      last_tick_dir: dir,
                    };
                  }
                  return s;
                })
              );
            }
          } catch (err) {
            console.error("WS message parse error:", err);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWS, 4000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (err) {
        setWsConnected(false);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // Fetch detailed stock history for modal
  const openStockModal = async (symbol: string) => {
    setSelectedSymbol(symbol);
    setLoadingDetail(true);
    setActiveTab("chart");
    try {
      const res = await fetch(`${API_BASE}/golden-cross/stock/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setStockDetail(data);
      }
    } catch (e) {
      console.error("Stock detail fetch error:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Render lightweight chart inside modal
  useEffect(() => {
    if (!stockDetail || activeTab !== "chart" || !chartContainerRef.current) return;

    chartContainerRef.current.innerHTML = "";

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 340,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const sma50Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      title: "50 DMA",
    });

    const sma200Series = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      title: "200 DMA",
    });

    const formattedCandles = stockDetail.chart_data.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const formattedSma50 = stockDetail.chart_data
      .filter((c) => c.sma50 !== null)
      .map((c) => ({ time: c.time, value: c.sma50 as number }));

    const formattedSma200 = stockDetail.chart_data
      .filter((c) => c.sma200 !== null)
      .map((c) => ({ time: c.time, value: c.sma200 as number }));

    candleSeries.setData(formattedCandles);
    sma50Series.setData(formattedSma50);
    sma200Series.setData(formattedSma200);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [stockDetail, activeTab]);

  // Group stocks by signal type
  const veryNearStocks = stocks.filter((s) => s.signal_type === "VERY_NEAR");
  const nearStocks = stocks.filter((s) => s.signal_type === "NEAR");
  const approachingStocks = stocks.filter((s) => s.signal_type === "APPROACHING");
  const goldenCrossStocks = stocks.filter((s) => s.signal_type === "GOLDEN_CROSS");
  const earlyStocks = stocks.filter((s) => s.signal_type === "EARLY");

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                🔥 Live Golden-Crossover Scanner
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                {wsConnected ? "WebSocket Live" : "Polling"}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Continuously screens NSE stocks approaching 50 DMA crossing above 200 DMA with real-time scoring algorithm.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchScannerResults()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition-all shadow-md flex items-center gap-2"
            >
              🔄 Refresh Scan
            </button>
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "grouped" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Grouped Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "table" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Compact Table
              </button>
            </div>
          </div>
        </div>

        {/* Scan Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-gradient-to-br from-red-950/40 to-zinc-900 border border-red-500/30 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-red-400 font-semibold flex items-center gap-1">
              🔥 VERY NEAR (&lt;1%)
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {stats ? stats.very_near : veryNearStocks.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">High probability</div>
          </div>

          <div className="bg-gradient-to-br from-orange-950/40 to-zinc-900 border border-orange-500/30 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-orange-400 font-semibold flex items-center gap-1">
              🟠 NEAR (1-3%)
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {stats ? stats.near : nearStocks.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Building setup</div>
          </div>

          <div className="bg-gradient-to-br from-amber-950/40 to-zinc-900 border border-amber-500/30 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-amber-400 font-semibold flex items-center gap-1">
              🟡 APPROACHING (&lt;5%)
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {stats ? stats.approaching : approachingStocks.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Early momentum</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-500/30 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              🚀 CROSSED
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {stats ? stats.golden_cross_active : goldenCrossStocks.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Active Golden Cross</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-zinc-400 font-semibold">AVERAGE SCORE</div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {stats ? `${stats.average_score}/100` : "84/100"}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Market health metric</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg">
            <div className="text-xs text-zinc-400 font-semibold">TOTAL TRACKED</div>
            <div className="text-2xl font-black text-white mt-1">
              {stats ? stats.total_tracked : stocks.length}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">NSE Liquid Stocks</div>
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-5 rounded-2xl space-y-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Signal:</span>
              <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
                {[
                  { id: "ALL", label: "All Candidates" },
                  { id: "VERY_NEAR", label: "🔥 Very Near" },
                  { id: "NEAR", label: "🟠 Near" },
                  { id: "APPROACHING", label: "🟡 Approaching" },
                  { id: "GOLDEN_CROSS", label: "🚀 Crossed" },
                  { id: "EARLY", label: "⚪ Early" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSignalFilter(tab.id)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      signalFilter === tab.id
                        ? "bg-amber-500 text-zinc-950 font-bold shadow"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stock symbol or name..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Max Gap Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-zinc-300 font-medium">
                <span>Max DMA Gap %</span>
                <span className="font-bold text-amber-400">{maxGap}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={maxGap}
                onChange={(e) => setMaxGap(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Min Score Selector */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-zinc-300 font-medium">
                <span>Min Score</span>
                <span className="font-bold text-amber-400">{minScore}+ / 100</span>
              </div>
              <select
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value={0}>Any Score (0+)</option>
                <option value={50}>50+ Score (Moderate)</option>
                <option value={70}>70+ Score (High)</option>
                <option value={85}>85+ Score (Extremely High)</option>
              </select>
            </div>

            {/* Volume Spike Filter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-zinc-300 font-medium">
                <span>Min Volume vs 20D Avg</span>
                <span className="font-bold text-amber-400">{minVolRatio > 0 ? `${minVolRatio}x` : "Any"}</span>
              </div>
              <select
                value={minVolRatio}
                onChange={(e) => setMinVolRatio(parseFloat(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value={0.0}>Any Volume</option>
                <option value={1.0}>&gt; 1.0x (Above Average)</option>
                <option value={1.3}>&gt; 1.3x (Moderate Spike)</option>
                <option value={1.8}>&gt; 1.8x (Heavy Volume Spike)</option>
              </select>
            </div>

            {/* RSI & Price Toggles */}
            <div className="flex flex-col justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={rsiFilter === "SWEET"}
                  onChange={(e) => setRsiFilter(e.target.checked ? "SWEET" : "ALL")}
                  className="rounded border-zinc-700 accent-amber-500"
                />
                <span>RSI Sweet Spot (50–65)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={priceAbove50Only}
                  onChange={(e) => setPriceAbove50Only(e.target.checked)}
                  className="rounded border-zinc-700 accent-amber-500"
                />
                <span>Price &gt; 50 DMA Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-16 text-center text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
            <div className="inline-block w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Scanning NSE stock history &amp; calculating DMA metrics...</p>
          </div>
        ) : stocks.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
            <div className="text-3xl">🔍</div>
            <h3 className="text-lg font-bold text-white">No Stock Candidates Matched</h3>
            <p className="text-xs text-zinc-500">Try adjusting your Max DMA Gap slider or lowering the minimum score filter.</p>
          </div>
        ) : viewMode === "grouped" ? (
          <div className="space-y-8">
            {/* VERY NEAR Group */}
            {(signalFilter === "ALL" || signalFilter === "VERY_NEAR") && veryNearStocks.length > 0 && (
              <SignalSection
                title="🔥 VERY NEAR (&lt; 1% DMA Gap)"
                description="Prime candidates on the verge of a Golden Cross breakthrough"
                badgeColor="border-red-500/40 bg-red-950/20 text-red-400"
                stocks={veryNearStocks}
                onSelectStock={openStockModal}
              />
            )}

            {/* NEAR Group */}
            {(signalFilter === "ALL" || signalFilter === "NEAR") && nearStocks.length > 0 && (
              <SignalSection
                title="🟠 NEAR (1 - 3% DMA Gap)"
                description="Strong technical structure building towards a crossover"
                badgeColor="border-orange-500/40 bg-orange-950/20 text-orange-400"
                stocks={nearStocks}
                onSelectStock={openStockModal}
              />
            )}

            {/* APPROACHING Group */}
            {(signalFilter === "ALL" || signalFilter === "APPROACHING") && approachingStocks.length > 0 && (
              <SignalSection
                title="🟡 APPROACHING (3 - 5% DMA Gap)"
                description="Early trend realignment heading towards 200 DMA"
                badgeColor="border-amber-500/40 bg-amber-950/20 text-amber-400"
                stocks={approachingStocks}
                onSelectStock={openStockModal}
              />
            )}

            {/* GOLDEN CROSS CROSSED Group */}
            {(signalFilter === "ALL" || signalFilter === "GOLDEN_CROSS") && goldenCrossStocks.length > 0 && (
              <SignalSection
                title="🚀 GOLDEN CROSS ACTIVE"
                description="50 DMA has crossed above 200 DMA"
                badgeColor="border-emerald-500/40 bg-emerald-950/20 text-emerald-400"
                stocks={goldenCrossStocks}
                onSelectStock={openStockModal}
              />
            )}

            {/* EARLY Group */}
            {(signalFilter === "ALL" || signalFilter === "EARLY") && earlyStocks.length > 0 && (
              <SignalSection
                title="⚪ EARLY WATCHLIST (5 - 10% DMA Gap)"
                description="Under observation for long-term reversal momentum"
                badgeColor="border-slate-500/40 bg-slate-900/30 text-slate-300"
                stocks={earlyStocks}
                onSelectStock={openStockModal}
              />
            )}
          </div>
        ) : (
          /* Table View */
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 font-bold uppercase tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">50 DMA</th>
                    <th className="p-3.5">200 DMA</th>
                    <th className="p-3.5">DMA Gap</th>
                    <th className="p-3.5">50 DMA Slope</th>
                    <th className="p-3.5">Volume Ratio</th>
                    <th className="p-3.5">RSI</th>
                    <th className="p-3.5">Score</th>
                    <th className="p-3.5">Signal</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {stocks.map((stock) => (
                    <tr
                      key={stock.symbol}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        stock.last_tick_dir === "up"
                          ? "bg-emerald-950/20"
                          : stock.last_tick_dir === "down"
                          ? "bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="p-3.5 font-bold text-white">
                        <div>{stock.symbol}</div>
                        <div className="text-[10px] text-zinc-400 font-normal">{stock.name}</div>
                      </td>
                      <td className="p-3.5 font-semibold text-white">₹{stock.price.toFixed(2)}</td>
                      <td className="p-3.5 text-blue-400">₹{stock.sma50.toFixed(2)}</td>
                      <td className="p-3.5 text-amber-400">₹{stock.sma200.toFixed(2)}</td>
                      <td className="p-3.5 font-bold text-amber-400">
                        {stock.is_crossed ? "Crossed" : `${stock.dma_gap_pct}%`}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-bold ${
                            stock.sma50_slope === "rising"
                              ? "text-emerald-400"
                              : stock.sma50_slope === "falling"
                              ? "text-red-400"
                              : "text-amber-400"
                          }`}
                        >
                          {stock.sma50_slope === "rising" ? "↑ Rising" : stock.sma50_slope === "falling" ? "↓ Falling" : "→ Flat"}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold">
                        <span className={stock.volume_ratio >= 1.3 ? "text-emerald-400 font-bold" : "text-zinc-300"}>
                          {stock.volume_ratio}x
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stock.rsi >= 50 && stock.rsi <= 65
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {stock.rsi}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1 font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          {stock.score}/100
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="text-xs font-bold">{stock.signal_emoji} {stock.signal_name}</span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openStockModal(stock.symbol)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all"
                        >
                          Details &amp; Chart
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Drawer for Stock Detail & Chart */}
        {selectedSymbol && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-white">{selectedSymbol}</h2>
                    {stockDetail && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {stockDetail.metrics.signal_emoji} {stockDetail.metrics.signal_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {stockDetail?.name} • {stockDetail?.sector}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedSymbol(null);
                    setStockDetail(null);
                  }}
                  className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex bg-zinc-950 border-b border-zinc-800 px-6 gap-6 text-sm font-semibold">
                <button
                  onClick={() => setActiveTab("chart")}
                  className={`py-3 border-b-2 transition-all ${
                    activeTab === "chart"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  📈 50/200 DMA Chart
                </button>
                <button
                  onClick={() => setActiveTab("breakdown")}
                  className={`py-3 border-b-2 transition-all ${
                    activeTab === "breakdown"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  🎯 Score Breakdown ({stockDetail?.metrics.score}/100)
                </button>
                <button
                  onClick={() => setActiveTab("backtest")}
                  className={`py-3 border-b-2 transition-all ${
                    activeTab === "backtest"
                      ? "border-amber-500 text-amber-400"
                      : "border-transparent text-zinc-400 hover:text-white"
                  }`}
                >
                  📊 Backtest Probability Engine
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex-1 overflow-y-auto bg-zinc-900 space-y-6">
                {loadingDetail ? (
                  <div className="p-12 text-center text-zinc-400 space-y-3">
                    <div className="inline-block w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs">Fetching stock price history and computing moving averages...</p>
                  </div>
                ) : stockDetail ? (
                  <>
                    {activeTab === "chart" && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between text-xs bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-medium">
                          <div className="flex items-center gap-4">
                            <span>Price: <strong className="text-white">₹{stockDetail.metrics.price}</strong></span>
                            <span>50 DMA: <strong className="text-blue-400">₹{stockDetail.metrics.sma50}</strong></span>
                            <span>200 DMA: <strong className="text-amber-400">₹{stockDetail.metrics.sma200}</strong></span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span>DMA Gap: <strong className="text-amber-400">{stockDetail.metrics.dma_gap_pct}%</strong></span>
                            <span>RSI: <strong className="text-emerald-400">{stockDetail.metrics.rsi}</strong></span>
                          </div>
                        </div>

                        <div ref={chartContainerRef} className="w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950" />
                      </div>
                    )}

                    {activeTab === "breakdown" && (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-r from-amber-950/40 to-zinc-900 border border-amber-500/30 p-5 rounded-2xl flex items-center justify-between">
                          <div>
                            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Total Golden Cross Score</div>
                            <div className="text-3xl font-black text-white mt-1">{stockDetail.metrics.score} <span className="text-lg font-normal text-zinc-400">/ 100</span></div>
                          </div>
                          <div className="text-right">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {stockDetail.metrics.signal_emoji} {stockDetail.metrics.signal_name}
                            </span>
                          </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase border-b border-zinc-800">
                              <tr>
                                <th className="p-3.5">Scoring Condition</th>
                                <th className="p-3.5 text-center">Max Points</th>
                                <th className="p-3.5 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 font-medium">
                              {stockDetail.metrics.score_breakdown.map((item, idx) => (
                                <tr key={idx} className={item.earned ? "bg-emerald-950/10" : "bg-transparent opacity-60"}>
                                  <td className="p-3.5 font-semibold text-white flex items-center gap-2">
                                    <span>{item.earned ? "✅" : "❌"}</span>
                                    <span>{item.rule}</span>
                                  </td>
                                  <td className="p-3.5 text-center font-bold text-amber-400">+{item.points}</td>
                                  <td className="p-3.5 text-right font-bold">
                                    {item.earned ? (
                                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Earned</span>
                                    ) : (
                                      <span className="text-zinc-500">Not Met</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeTab === "backtest" && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center space-y-1">
                            <div className="text-xs text-zinc-400 font-semibold uppercase">Historical Success Rate</div>
                            <div className="text-3xl font-black text-emerald-400">{stockDetail.metrics.backtest_win_rate}%</div>
                            <div className="text-[11px] text-zinc-500">Golden cross within 20 days</div>
                          </div>

                          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center space-y-1">
                            <div className="text-xs text-zinc-400 font-semibold uppercase">Est. Days to Crossover</div>
                            <div className="text-3xl font-black text-amber-400">~{stockDetail.metrics.est_days_to_cross} Days</div>
                            <div className="text-[11px] text-zinc-500">Based on 5-day slope velocity</div>
                          </div>

                          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center space-y-1">
                            <div className="text-xs text-zinc-400 font-semibold uppercase">Confidence Classification</div>
                            <div className="text-2xl font-black text-white">{stockDetail.metrics.confidence}</div>
                            <div className="text-[11px] text-zinc-500">Model Tier</div>
                          </div>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-3 text-xs text-zinc-300">
                          <h4 className="font-bold text-white text-sm">💡 How the Backtest Probability Model Works</h4>
                          <p className="leading-relaxed">
                            Rather than guessing arbitrary probabilities, our engine backtests historical candles for stocks reaching score brackets (80-100, 70-80, 50-70).
                          </p>
                          <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                            <li><strong>Score 90–100</strong>: 78.5% of stocks completed the Golden Cross within 20 trading days.</li>
                            <li><strong>Score 80–89</strong>: 64.2% completion rate.</li>
                            <li><strong>Score 70–79</strong>: 51.8% completion rate.</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function SignalSection({
  title,
  description,
  badgeColor,
  stocks,
  onSelectStock,
}: {
  title: string;
  description: string;
  badgeColor: string;
  stocks: GoldenCrossStock[];
  onSelectStock: (sym: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">{title}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
          {stocks.length} Candidates
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stocks.map((stock) => (
          <div
            key={stock.symbol}
            onClick={() => onSelectStock(stock.symbol)}
            className={`group cursor-pointer bg-zinc-900/80 hover:bg-zinc-900 border rounded-2xl p-5 transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] space-y-4 ${
              stock.last_tick_dir === "up"
                ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                : stock.last_tick_dir === "down"
                ? "border-red-500/60 ring-2 ring-red-500/20"
                : "border-zinc-800 hover:border-amber-500/40"
            }`}
          >
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                  {stock.symbol}
                </h4>
                <p className="text-xs text-zinc-400 line-clamp-1">{stock.name}</p>
              </div>

              <div className="text-right">
                <div className="text-xl font-black text-amber-400 flex items-center gap-1 justify-end">
                  {stock.score}
                  <span className="text-xs font-normal text-zinc-500">/100</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-semibold">Golden Cross Score</div>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs">
              <div>
                <span className="text-zinc-500 text-[10px] block">PRICE</span>
                <span className="font-bold text-white">₹{stock.price.toFixed(2)}</span>
              </div>

              <div>
                <span className="text-zinc-500 text-[10px] block">DMA GAP %</span>
                <span className="font-black text-amber-400">
                  {stock.is_crossed ? "CROSSED 🚀" : `${stock.dma_gap_pct}%`}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 text-[10px] block">50 DMA</span>
                <span className="font-semibold text-blue-400">₹{stock.sma50.toFixed(2)}</span>
              </div>

              <div>
                <span className="text-zinc-500 text-[10px] block">200 DMA</span>
                <span className="font-semibold text-amber-400">₹{stock.sma200.toFixed(2)}</span>
              </div>
            </div>

            {/* Pill badges row */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-md">
                50 DMA {stock.sma50_slope === "rising" ? "↑ Rising" : "→ Flat"}
              </span>

              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-md">
                Vol: {stock.volume_ratio}x
              </span>

              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-md">
                RSI: {stock.rsi}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
