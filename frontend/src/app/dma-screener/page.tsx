"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";

type DMAStock = {
  symbol: string;
  price: number;
  sma50: number;
  sma200: number;
  distance_pct: number;
  volume_spike: number;
  rsi: number;
  macd_bullish: boolean;
  probability_score: number;
  probability_class: "High" | "Medium" | "Low";
  setup_type: string;
  ai_analysis: string;
};

const SETUP_TABS = [
  { key: "all", label: "All Setups", icon: "⚡" },
  { key: "Near 50 DMA", label: "Near 50 DMA", icon: "📍" },
  { key: "Crossing Above", label: "Crossing Above", icon: "🚀" },
  { key: "Golden Trend", label: "Golden Trend", icon: "✨" },
] as const;

const PAGE_SIZE = 20;

export default function DMAScreenerPage() {
  const [data, setData] = useState<DMAStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: keyof DMAStock; direction: "asc" | "desc" }>({ key: "probability_score", direction: "desc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [scannedCount, setScannedCount] = useState(0);

  const fetchScan = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/dma-screener/scan?index=NIFTY%20500");
      if (res.ok) {
        const json = await res.json();
        setData(json.results);
        setScannedCount(json.scanned);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScan();
    const interval = setInterval(fetchScan, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (key: keyof DMAStock) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const getSortIndicator = (key: keyof DMAStock) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  // Filter + Search + Sort pipeline
  const processedData = useMemo(() => {
    let filtered = data;

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((s) => s.setup_type === activeTab);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      filtered = filtered.filter((s) => s.symbol.includes(q));
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, activeTab, searchQuery, sortConfig]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processedData.length / PAGE_SIZE));
  const paginatedData = processedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // CSV Export
  const exportCSV = () => {
    const headers = ["Symbol", "CMP", "50 DMA", "200 DMA", "Distance %", "Setup Type", "Vol Spike", "RSI", "MACD", "Prob Score", "Prob Class", "AI Analysis"];
    const rows = processedData.map((s) => [
      s.symbol,
      s.price.toFixed(2),
      s.sma50.toFixed(2),
      s.sma200.toFixed(2),
      s.distance_pct.toFixed(2),
      s.setup_type,
      s.volume_spike.toFixed(2),
      s.rsi.toFixed(1),
      s.macd_bullish ? "Bullish" : "Bearish",
      s.probability_score.toFixed(0),
      s.probability_class,
      `"${s.ai_analysis || ""}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `50dma_opportunities_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getProbColor = (p: string) => {
    if (p === "High") return "bg-emerald-900/50 text-emerald-400 border border-emerald-800";
    if (p === "Medium") return "bg-amber-900/50 text-amber-400 border border-amber-800";
    return "bg-red-900/50 text-red-400 border border-red-800";
  };

  const getSetupColor = (s: string) => {
    if (s === "Near 50 DMA") return "bg-blue-900/30 text-blue-400 border-blue-800/50";
    if (s === "Crossing Above") return "bg-emerald-900/30 text-emerald-400 border-emerald-800/50";
    if (s === "Golden Trend") return "bg-yellow-900/30 text-yellow-400 border-yellow-800/50";
    return "bg-zinc-800 text-zinc-400 border-zinc-700";
  };

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.length };
    data.forEach((s) => {
      counts[s.setup_type] = (counts[s.setup_type] || 0) + 1;
    });
    return counts;
  }, [data]);

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              50 DMA Opportunities
              {loading && (
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-xl">
              Professional screener filtering stocks near, crossing, or bouncing from the 50-day moving average.
              {scannedCount > 0 && <span className="text-zinc-500"> · Scanned {scannedCount} stocks</span>}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchScan}
              disabled={loading}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors border border-zinc-700 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                Refresh
              </span>
            </button>
            <button
              onClick={exportCSV}
              disabled={processedData.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export CSV
            </button>
          </div>
        </header>

        {/* Setup Type Tabs */}
        <div className="flex flex-wrap gap-2">
          {SETUP_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activeTab === tab.key
                  ? "border-blue-600/60 bg-blue-900/20 text-blue-400"
                  : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? "bg-blue-900/50 text-blue-300" : "bg-zinc-700 text-zinc-500"
              }`}>
                {tabCounts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            type="text"
            placeholder="Search stock by symbol... (e.g. BHEL, TCS, RELIANCE)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors uppercase"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-[#1c1c1c] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-zinc-400 bg-zinc-900/50 border-b border-zinc-800 uppercase">
                <tr>
                  {([
                    { key: "symbol" as const, label: "Stock Name" },
                    { key: "price" as const, label: "CMP (₹)" },
                    { key: "sma50" as const, label: "50 DMA" },
                    { key: "sma200" as const, label: "200 DMA" },
                    { key: "distance_pct" as const, label: "Dist from 50 DMA" },
                    { key: "setup_type" as const, label: "Setup Type" },
                    { key: "volume_spike" as const, label: "Vol Spike" },
                    { key: "rsi" as const, label: "RSI" },
                    { key: "macd_bullish" as const, label: "MACD" },
                    { key: "probability_score" as const, label: "AI Prob Score" },
                  ]).map((col) => (
                    <th
                      key={col.key}
                      className="px-5 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}{getSortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-zinc-500 text-sm">Scanning NIFTY 500 for 50 DMA setups...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                      No matching setups found{searchQuery ? ` for "${searchQuery}"` : ""}.
                    </td>
                  </tr>
                )}
                {paginatedData.map((stock, i) => (
                  <tr
                    key={stock.symbol}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors group ${
                      i % 2 === 0 ? "" : "bg-zinc-900/30"
                    }`}
                  >
                    <td className="px-5 py-4 font-bold text-blue-400 group-hover:text-blue-300">
                      <Link href={`/stock/${stock.symbol}`} className="hover:underline underline-offset-2">{stock.symbol}</Link>
                    </td>
                    <td className="px-5 py-4 text-zinc-100 font-medium">₹{stock.price.toFixed(2)}</td>
                    <td className="px-5 py-4 text-zinc-400">{stock.sma50.toFixed(2)}</td>
                    <td className="px-5 py-4 text-zinc-400">{stock.sma200.toFixed(2)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${stock.distance_pct <= 2 ? "bg-emerald-900/30 text-emerald-400" : "text-zinc-300"}`}>
                        {stock.distance_pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 border rounded-full text-xs font-medium ${getSetupColor(stock.setup_type)}`}>
                        {stock.setup_type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={stock.volume_spike > 1.5 ? "text-emerald-400 font-medium" : "text-zinc-300"}>
                        {stock.volume_spike.toFixed(1)}x
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={stock.rsi > 50 ? "text-emerald-400" : stock.rsi < 30 ? "text-red-400" : "text-zinc-400"}>
                        {stock.rsi.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {stock.macd_bullish ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                          Bullish
                        </span>
                      ) : (
                        <span className="text-zinc-500">Bearish</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              stock.probability_score >= 75 ? "bg-emerald-500" : stock.probability_score >= 50 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${stock.probability_score}%` }}
                          ></div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getProbColor(stock.probability_class)}`}>
                          {stock.probability_score.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between text-sm text-zinc-500 bg-zinc-900/30">
            <span>
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, processedData.length)}–
              {Math.min(currentPage * PAGE_SIZE, processedData.length)} of {processedData.length} results
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              >
                ← Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white"
                        : "hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
