"use client";

import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { getSectorScreener, type SectorScreenerResponse, type SectorResult } from "@/lib/api";

const SECTOR_COLORS: Record<string, string> = {
  NIFTY_AUTO: "#a855f7",       // Purple
  NIFTY_BANK: "#3b82f6",       // Blue
  NIFTY_PHARMA: "#10b981",     // Emerald
  NIFTY_IT: "#22c55e",         // Green
  NIFTY_ENERGY: "#ef4444",     // Red
  NIFTY_FMCG: "#06b6d4",       // Cyan
  NIFTY_PSU_BANK: "#ec4899",   // Pink
  NIFTY_METAL: "#f59e0b",      // Amber
  NIFTY_REALTY: "#8b5cf6",     // Violet
  NIFTY_INFRA: "#14b8a6",      // Teal
  NIFTY_CONSUMPTION: "#f97316",// Orange
  NIFTY_SERVICES: "#6366f1",   // Indigo
  NIFTY_COMMODITIES: "#84cc16",// Lime
  BENCHMARK: "#9ca3af",        // Gray
};

export default function SectorAnalysisPage() {
  const [timeframe, setTimeframe] = useState<string>("1M");
  const [benchmark, setBenchmark] = useState<string>("NIFTY_500");
  const [data, setData] = useState<SectorScreenerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSector, setActiveSector] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    getSectorScreener(timeframe, benchmark)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to load sector data");
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [timeframe, benchmark]);

  // Chart data calculations
  const chartSeries = useMemo(() => {
    if (!data || !data.chart_data || data.chart_data.length === 0) return null;
    const dates = data.chart_data.map((d) => d.date);

    // Collect all series keys except date
    const keys = Object.keys(data.chart_data[0]).filter((k) => k !== "date");

    // Compute min and max values for scaling Y axis
    let minVal = 0;
    let maxVal = 0;
    data.chart_data.forEach((row) => {
      keys.forEach((key) => {
        const val = row[key];
        if (typeof val === "number") {
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      });
    });

    const padding = (maxVal - minVal) * 0.1 || 5;
    minVal = Math.floor(minVal - padding);
    maxVal = Math.ceil(maxVal + padding);

    return { dates, keys, minVal, maxVal };
  }, [data]);

  const renderRankChange = (val: number) => {
    if (val > 0) {
      return <span className="text-emerald-400 font-semibold flex items-center gap-0.5">▲ {val}</span>;
    }
    if (val < 0) {
      return <span className="text-red-400 font-semibold flex items-center gap-0.5">▼ {Math.abs(val)}</span>;
    }
    return <span className="text-zinc-500">-</span>;
  };

  const renderTableSection = (
    title: string,
    badgeColor: string,
    list: SectorResult[],
    trendIcon: string
  ) => (
    <div className="flex-1 bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
      <div className={`px-3 py-2 border-b border-zinc-800 text-xs font-bold uppercase tracking-wider flex justify-between items-center ${badgeColor}`}>
        <span>{title} ({list.length})</span>
        <span className="text-[10px] font-normal text-zinc-400">TREND</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/50">
              <th className="py-2 px-2.5 font-medium">RANK</th>
              <th className="py-2 px-2 font-medium">Chg (5)</th>
              <th className="py-2 px-2 font-medium">Chg (21)</th>
              <th className="py-2 px-2.5 font-medium">INDEX</th>
              <th className="py-2 px-2 text-center font-medium">TREND</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-500 italic text-xs">
                  None in this category
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const isSelected = activeSector === r.sector;
                const color = SECTOR_COLORS[r.sector] || "#3b82f6";
                return (
                  <tr
                    key={r.sector}
                    onClick={() => setActiveSector(isSelected ? null : r.sector)}
                    className={`cursor-pointer transition-colors hover:bg-zinc-800/60 ${
                      isSelected ? "bg-zinc-800 border-l-2 border-blue-500" : ""
                    }`}
                  >
                    <td className="py-2 px-2.5 font-semibold text-zinc-300">{r.rank}</td>
                    <td className="py-2 px-2">{renderRankChange(r.chg_5d)}</td>
                    <td className="py-2 px-2">{renderRankChange(r.chg_21d)}</td>
                    <td className="py-2 px-2.5 font-medium flex items-center gap-1.5 text-zinc-100">
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span>{r.display_name}</span>
                    </td>
                    <td className="py-2 px-2 text-center text-base leading-none">{trendIcon}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Sector Relative Strength
              </h1>
              {data && (
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                    data.sentiment === "BULLISH"
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                      : data.sentiment === "BEARISH"
                      ? "bg-red-950/80 text-red-400 border-red-800"
                      : "bg-blue-950/80 text-blue-400 border-blue-800"
                  }`}
                >
                  Sentiment: {data.sentiment}
                </span>
              )}
            </div>
            <p className="text-zinc-400 text-xs md:text-sm mt-1">
              Benchmark: <span className="text-zinc-200 font-medium">{data?.benchmark_name || "NSE CNX500"}</span> · Real-time multi-period sector rotation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Benchmark Toggle */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
              <button
                onClick={() => setBenchmark("NIFTY_500")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  benchmark === "NIFTY_500"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                NSE CNX500
              </button>
              <button
                onClick={() => setBenchmark("NIFTY_50")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  benchmark === "NIFTY_50"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                NIFTY 50
              </button>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
              {["1M", "3M", "6M", "1Y"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    timeframe === tf
                      ? "bg-blue-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-zinc-400 text-sm">Loading real sector data from NSE…</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-950/40 border border-red-800/80 rounded-2xl text-red-300 text-sm text-center">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Interactive Performance Line Chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <span>📈 Performance Benchmark Comparison (%)</span>
                  <span className="text-xs font-normal text-zinc-400">
                    ({data.timeframe})
                  </span>
                </h2>
                {activeSector && (
                  <button
                    onClick={() => setActiveSector(null)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
                    Reset chart highlight
                  </button>
                )}
              </div>

              {chartSeries && (
                <div className="w-full">
                  <div className="h-64 md:h-80 w-full relative">
                    <svg
                      viewBox="0 0 800 320"
                      className="w-full h-full overflow-visible"
                      preserveAspectRatio="none"
                    >
                      {/* Grid Lines & Labels */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                        const y = 30 + pct * 250;
                        const val = (
                          chartSeries.maxVal -
                          pct * (chartSeries.maxVal - chartSeries.minVal)
                        ).toFixed(1);
                        return (
                          <g key={i}>
                            <line
                              x1="40"
                              y1={y}
                              x2="790"
                              y2={y}
                              stroke="#27272a"
                              strokeDasharray="4 4"
                            />
                            <text
                              x="35"
                              y={y + 4}
                              textAnchor="end"
                              className="fill-zinc-500 text-[10px]"
                            >
                              {val > "0" ? `+${val}%` : `${val}%`}
                            </text>
                          </g>
                        );
                      })}

                      {/* Zero line */}
                      {chartSeries.minVal <= 0 && chartSeries.maxVal >= 0 && (
                        <line
                          x1="40"
                          y1={
                            30 +
                            (1 -
                              (0 - chartSeries.minVal) /
                                (chartSeries.maxVal - chartSeries.minVal)) *
                              250
                          }
                          x2="790"
                          y2={
                            30 +
                            (1 -
                              (0 - chartSeries.minVal) /
                                (chartSeries.maxVal - chartSeries.minVal)) *
                              250
                          }
                          stroke="#52525b"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* X-Axis Date Labels */}
                      {chartSeries.dates.map((d, i) => {
                        if (
                          i % Math.ceil(chartSeries.dates.length / 6) !== 0 &&
                          i !== chartSeries.dates.length - 1
                        )
                          return null;
                        const x =
                          40 +
                          (i / (chartSeries.dates.length - 1 || 1)) * 750;
                        return (
                          <text
                            key={i}
                            x={x}
                            y="300"
                            textAnchor="middle"
                            className="fill-zinc-400 text-[10px]"
                          >
                            {d}
                          </text>
                        );
                      })}

                      {/* Sector Lines */}
                      {chartSeries.keys.map((key) => {
                        const points = data.chart_data.map((row, i) => {
                          const val = row[key] ?? 0;
                          const x =
                            40 +
                            (i / (chartSeries.dates.length - 1 || 1)) * 750;
                          const y =
                            30 +
                            (1 -
                              (val - chartSeries.minVal) /
                                (chartSeries.maxVal - chartSeries.minVal || 1)) *
                              250;
                          return `${x},${y}`;
                        });
                        const color = SECTOR_COLORS[key] || "#3b82f6";
                        const isHighlighted = activeSector === key;
                        const opacity = activeSector
                          ? isHighlighted
                            ? 1
                            : 0.15
                          : key === "BENCHMARK"
                          ? 0.4
                          : 0.85;

                        return (
                          <path
                            key={key}
                            d={`M ${points.join(" L ")}`}
                            fill="none"
                            stroke={color}
                            strokeWidth={
                              isHighlighted ? "3" : key === "BENCHMARK" ? "1.5" : "2"
                            }
                            strokeDasharray={key === "BENCHMARK" ? "4 4" : undefined}
                            opacity={opacity}
                            className="transition-all duration-200"
                          />
                        );
                      })}
                    </svg>
                  </div>

                  {/* Sector Legend Pills */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-800">
                    {chartSeries.keys.map((key) => {
                      const color = SECTOR_COLORS[key] || "#3b82f6";
                      const isSelected = activeSector === key;
                      const displayName =
                        key === "BENCHMARK"
                          ? data.benchmark_name
                          : key.replace("NIFTY_", "");
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setActiveSector(isSelected ? null : key)
                          }
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? "bg-zinc-800 border-zinc-600 text-white scale-105"
                              : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span>{displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Rotation Header Summary Pill */}
            <div className="bg-gradient-to-r from-blue-950/80 via-zinc-900 to-indigo-950/80 border border-blue-800/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
              <div className="flex items-center gap-2 text-blue-300 font-semibold">
                <span>🔄 MIXED ROTATION</span>
                <span className="text-zinc-500">|</span>
                <span className="text-emerald-400">Out: {data.rotation.outperform_count}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-blue-400">Mixed: {data.rotation.mixed_count}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-red-400">Under: {data.rotation.underperform_count}</span>
              </div>
              <span className="text-zinc-400 text-xs">
                Updated live · RS threshold: ±1.5% vs {data.benchmark_symbol}
              </span>
            </div>

            {/* 3-Column Relative Strength Table (TradingView style overlay) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {renderTableSection(
                "OUTPERFORM",
                "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
                data.outperform_list,
                "🟢"
              )}
              {renderTableSection(
                "MIXED",
                "bg-blue-950/60 text-blue-300 border-blue-800/60",
                data.mixed_list,
                "➡️"
              )}
              {renderTableSection(
                "UNDERPERFORM",
                "bg-red-950/60 text-red-300 border-red-800/60",
                data.underperform_list,
                "🔴"
              )}
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
