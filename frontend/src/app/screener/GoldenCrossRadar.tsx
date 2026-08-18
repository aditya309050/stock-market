"use client";

import { useState, useEffect } from "react";

export interface GoldenCrossItem {
  symbol: string;
  company_name: string;
  last_price: number;
  dma50: number;
  dma200: number;
  gap_pct: number;
  status: "provisional" | "confirmed";
  is_golden_cross: boolean;
  is_near_cross: boolean;
  is_above_200: boolean;
  is_above_50: number;
  score: number;
  timestamp: string;
}

export interface GoldenCrossRadarResponse {
  total_scanned: number;
  golden_cross_count: number;
  near_cross_count: number;
  provisional_count: number;
  results: GoldenCrossItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export function GoldenCrossRadar() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GoldenCrossRadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIntraday, setIsIntraday] = useState(false);

  const fetchRadar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/golden-cross/radar?is_intraday=${isIntraday}`
      );
      if (!res.ok) throw new Error("Failed to fetch Golden Cross Radar");
      const json = await res.json();

      setData(json);
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadar();
  }, [isIntraday]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🚀 DhanHQ Golden Cross Radar
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time 50/200 DMA cross events & near-cross proximity across NSE Equity universe
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isIntraday}
              onChange={(e) => setIsIntraday(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            Intraday Live Ticks Mode
          </label>

          <button
            onClick={fetchRadar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors"
          >
            {loading ? "Scanning Universe..." : "Refresh Scan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-300 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
            <span className="text-xs text-zinc-400 block">Total Scanned</span>
            <span className="text-xl font-bold text-white">{data.total_scanned}</span>
          </div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl">
            <span className="text-xs text-emerald-400 block">Golden Crosses</span>
            <span className="text-xl font-bold text-emerald-300">{data.golden_cross_count}</span>
          </div>
          <div className="bg-blue-950/20 border border-blue-800/40 p-4 rounded-xl">
            <span className="text-xs text-blue-400 block">Near Cross (&le;3% Gap)</span>
            <span className="text-xl font-bold text-blue-300">{data.near_cross_count}</span>
          </div>
          <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-xl">
            <span className="text-xs text-amber-400 block">Provisional Signals</span>
            <span className="text-xl font-bold text-amber-300">{data.provisional_count}</span>
          </div>
        </div>
      )}

      {data && data.results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.results.map((item) => {
            const isConfirmed = item.status === "confirmed";
            const isGolden = item.is_golden_cross;
            const isNear = item.is_near_cross;

            return (
              <div
                key={item.symbol}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-wide">
                      {item.symbol}
                    </h3>
                    <p className="text-xs text-zinc-400">{item.company_name}</p>
                  </div>

                  <div>
                    {isGolden ? (
                      isConfirmed ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                          🟢 CONFIRMED GOLDEN CROSS
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                          🟡 PROVISIONAL CROSS
                        </span>
                      )
                    ) : isNear ? (
                      <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                        🔵 NEAR CROSS ({item.gap_pct}% GAP)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full">
                        BULLISH SETUP
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-zinc-950/60 p-3 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-zinc-500 block">Price</span>
                    <span className="text-sm font-semibold text-white">
                      ₹{item.last_price?.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">50 DMA</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      ₹{item.dma50?.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">200 DMA</span>
                    <span className="text-sm font-semibold text-purple-400">
                      ₹{item.dma200?.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-zinc-400 pt-1">
                  <span>
                    DMA Gap:{" "}
                    <strong className={item.gap_pct <= 3 ? "text-amber-400" : "text-zinc-300"}>
                      {item.gap_pct}%
                    </strong>
                  </span>
                  <span>
                    Score: <strong className="text-white">{item.score} / 100</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
            No Golden Cross or Near Cross signals detected in the latest scan.
          </div>
        )
      )}
    </div>
  );
}
