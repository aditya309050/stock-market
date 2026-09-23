"use client";

import React, { useState, useMemo } from "react";

type HeatmapMetric = "oi" | "doi" | "volume" | "iv" | "liquidity";

interface ChainRow {
  strike: number;
  ce_oi: number;
  ce_doi: number;
  ce_ltp: number;
  ce_iv: number;
  ce_volume: number;
  pe_oi: number;
  pe_doi: number;
  pe_ltp: number;
  pe_iv: number;
  pe_volume: number;
  liquidity_score?: number;
}

interface OIHeatmapProps {
  rows: ChainRow[];
  atmStrike: number;
  spot: number;
  callWall: number;
  putWall: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function OIHeatmap({ rows, atmStrike, spot, callWall, putWall }: OIHeatmapProps) {
  const [metric, setMetric] = useState<HeatmapMetric>("oi");

  const ladder = useMemo(() => {
    return [...rows]
      .filter((r) => Math.abs(r.strike - atmStrike) <= 12 * 50)
      .sort((a, b) => b.strike - a.strike); // descending
  }, [rows, atmStrike]);

  const maxVal = useMemo(() => {
    let ceMax = 1, peMax = 1;
    for (const r of ladder) {
      if (metric === "oi") {
        ceMax = Math.max(ceMax, r.ce_oi);
        peMax = Math.max(peMax, r.pe_oi);
      } else if (metric === "doi") {
        ceMax = Math.max(ceMax, Math.abs(r.ce_doi));
        peMax = Math.max(peMax, Math.abs(r.pe_doi));
      } else if (metric === "volume") {
        ceMax = Math.max(ceMax, r.ce_volume);
        peMax = Math.max(peMax, r.pe_volume);
      } else if (metric === "iv") {
        ceMax = Math.max(ceMax, r.ce_iv);
        peMax = Math.max(peMax, r.pe_iv);
      } else if (metric === "liquidity") {
        ceMax = Math.max(ceMax, r.liquidity_score || 0);
        peMax = Math.max(peMax, r.liquidity_score || 0);
      }
    }
    return { ceMax, peMax };
  }, [ladder, metric]);

  const getValues = (r: ChainRow) => {
    switch (metric) {
      case "oi":
        return {
          ceVal: r.ce_oi,
          peVal: r.pe_oi,
          ceDisplay: fmtCompact(r.ce_oi),
          peDisplay: fmtCompact(r.pe_oi),
          cePct: (r.ce_oi / maxVal.ceMax) * 100,
          pePct: (r.pe_oi / maxVal.peMax) * 100,
        };
      case "doi":
        return {
          ceVal: r.ce_doi,
          peVal: r.pe_doi,
          ceDisplay: `${r.ce_doi >= 0 ? "+" : ""}${fmtCompact(r.ce_doi)}`,
          peDisplay: `${r.pe_doi >= 0 ? "+" : ""}${fmtCompact(r.pe_doi)}`,
          cePct: (Math.abs(r.ce_doi) / maxVal.ceMax) * 100,
          pePct: (Math.abs(r.pe_doi) / maxVal.peMax) * 100,
        };
      case "volume":
        return {
          ceVal: r.ce_volume,
          peVal: r.pe_volume,
          ceDisplay: fmtCompact(r.ce_volume),
          peDisplay: fmtCompact(r.pe_volume),
          cePct: (r.ce_volume / maxVal.ceMax) * 100,
          pePct: (r.pe_volume / maxVal.peMax) * 100,
        };
      case "iv":
        return {
          ceVal: r.ce_iv,
          peVal: r.pe_iv,
          ceDisplay: `${r.ce_iv.toFixed(1)}%`,
          peDisplay: `${r.pe_iv.toFixed(1)}%`,
          cePct: (r.ce_iv / maxVal.ceMax) * 100,
          pePct: (r.pe_iv / maxVal.peMax) * 100,
        };
      case "liquidity":
        const s = r.liquidity_score || 0;
        return {
          ceVal: s,
          peVal: s,
          ceDisplay: `${Math.round(s)} pts`,
          peDisplay: `${Math.round(s)} pts`,
          cePct: (s / 100) * 100,
          pePct: (s / 100) * 100,
        };
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <span>🔥</span> Dual-Sided Positioning Heatmap
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Compare Call side (resistance / overhead writing) vs Put side (support / floor writing).
          </p>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-xl text-xs font-bold">
          {[
            { id: "oi", label: "Open Interest" },
            { id: "doi", label: "ΔOI Change" },
            { id: "volume", label: "Volume" },
            { id: "iv", label: "IV" },
            { id: "liquidity", label: "Liquidity" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id as HeatmapMetric)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                metric === m.id
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column Titles */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-xs font-bold tracking-wider uppercase px-2">
        <div className="text-right text-blue-400 flex items-center justify-end gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span>CALL SIDE ({metric.toUpperCase()})</span>
        </div>
        <div className="w-28 text-center text-white bg-zinc-800/80 px-2 py-1 rounded">
          STRIKE
        </div>
        <div className="text-left text-orange-400 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
          <span>PUT SIDE ({metric.toUpperCase()})</span>
        </div>
      </div>

      {/* Heatmap Bars */}
      <div className="space-y-1">
        {ladder.map((r) => {
          const isATM = r.strike === atmStrike;
          const isCallWall = r.strike === callWall;
          const isPutWall = r.strike === putWall;
          const { ceDisplay, peDisplay, cePct, pePct } = getValues(r);

          return (
            <div
              key={r.strike}
              className={`grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-1.5 rounded-xl transition-colors ${
                isATM
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : isCallWall
                  ? "bg-blue-500/5 border border-blue-500/20"
                  : isPutWall
                  ? "bg-orange-500/5 border border-orange-500/20"
                  : "hover:bg-zinc-800/40"
              }`}
            >
              {/* Call Bar (right-aligned to strike) */}
              <div className="flex items-center justify-end gap-2">
                <span className="text-[11px] font-mono font-medium text-blue-300 min-w-[50px] text-right">
                  {ceDisplay}
                </span>
                <div className="w-48 bg-zinc-800/80 h-3.5 rounded-sm overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-blue-500 rounded-sm transition-all duration-300"
                    style={{ width: `${Math.max(1, cePct)}%` }}
                  />
                </div>
              </div>

              {/* Strike */}
              <div className="w-28 text-center">
                <span
                  className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                    isATM
                      ? "bg-yellow-400 text-zinc-950 shadow-sm"
                      : isCallWall
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                      : isPutWall
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                      : "text-zinc-200"
                  }`}
                >
                  {fmt(r.strike)}
                  {isATM && " ATM"}
                </span>
              </div>

              {/* Put Bar (left-aligned from strike) */}
              <div className="flex items-center gap-2">
                <div className="w-48 bg-zinc-800/80 h-3.5 rounded-sm overflow-hidden flex justify-start">
                  <div
                    className="h-full bg-orange-500 rounded-sm transition-all duration-300"
                    style={{ width: `${Math.max(1, pePct)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-medium text-orange-300 min-w-[50px] text-left">
                  {peDisplay}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
