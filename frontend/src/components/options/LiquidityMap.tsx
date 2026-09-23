"use client";

import React, { useState, useMemo } from "react";

export type LiquidityMetric = "score" | "oi" | "doi" | "volume" | "iv" | "gamma";

interface ChainRow {
  strike: number;
  ce_oi: number;
  ce_doi: number;
  ce_ltp: number;
  ce_iv: number;
  ce_volume: number;
  ce_delta: number;
  ce_gamma: number;
  pe_oi: number;
  pe_doi: number;
  pe_ltp: number;
  pe_iv: number;
  pe_volume: number;
  pe_delta: number;
  pe_gamma: number;
  liquidity_score?: number;
  liquidity_tag?: string;
}

interface LiquidityMapProps {
  rows: ChainRow[];
  atmStrike: number;
  spot: number;
  callWall: number;
  putWall: number;
  maxPain: number;
  onSelectStrike?: (strike: number) => void;
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function LiquidityMap({
  rows,
  atmStrike,
  spot,
  callWall,
  putWall,
  maxPain,
  onSelectStrike,
}: LiquidityMapProps) {
  const [metric, setMetric] = useState<LiquidityMetric>("score");
  const [selectedRow, setSelectedRow] = useState<ChainRow | null>(null);

  // Focus on ATM ± 12 strikes
  const ladder = useMemo(() => {
    return [...rows]
      .filter((r) => Math.abs(r.strike - atmStrike) <= 12 * 50)
      .sort((a, b) => b.strike - a.strike); // descending order: highest price at top
  }, [rows, atmStrike]);

  // Max values for normalization of intensity bars
  const maxValues = useMemo(() => {
    let mScore = 1, mOI = 1, mDOI = 1, mVol = 1, mIV = 1, mGamma = 1;
    for (const r of ladder) {
      mScore = Math.max(mScore, r.liquidity_score || 0);
      mOI = Math.max(mOI, r.ce_oi + r.pe_oi);
      mDOI = Math.max(mDOI, Math.abs(r.ce_doi) + Math.abs(r.pe_doi));
      mVol = Math.max(mVol, r.ce_volume + r.pe_volume);
      mIV = Math.max(mIV, (r.ce_iv + r.pe_iv) / 2);
      mGamma = Math.max(mGamma, r.ce_gamma + r.pe_gamma);
    }
    return { mScore, mOI, mDOI, mVol, mIV, mGamma };
  }, [ladder]);

  const getMetricData = (r: ChainRow) => {
    switch (metric) {
      case "score":
        return {
          pct: Math.min(100, ((r.liquidity_score || 50) / 100) * 100),
          display: `${r.liquidity_score || 0}/100`,
          barColor: (r.liquidity_score || 0) >= 75 ? "bg-violet-500" : (r.liquidity_score || 0) >= 50 ? "bg-cyan-500" : "bg-zinc-600",
        };
      case "oi":
        const totOI = r.ce_oi + r.pe_oi;
        return {
          pct: Math.min(100, (totOI / maxValues.mOI) * 100),
          display: fmtCompact(totOI),
          barColor: "bg-blue-500",
        };
      case "doi":
        const totDOI = Math.abs(r.ce_doi) + Math.abs(r.pe_doi);
        return {
          pct: Math.min(100, (totDOI / maxValues.mDOI) * 100),
          display: `${r.ce_doi + r.pe_doi >= 0 ? "+" : ""}${fmtCompact(r.ce_doi + r.pe_doi)}`,
          barColor: "bg-emerald-500",
        };
      case "volume":
        const totVol = r.ce_volume + r.pe_volume;
        return {
          pct: Math.min(100, (totVol / maxValues.mVol) * 100),
          display: fmtCompact(totVol),
          barColor: "bg-indigo-500",
        };
      case "iv":
        const avgIV = (r.ce_iv + r.pe_iv) / 2;
        return {
          pct: Math.min(100, (avgIV / maxValues.mIV) * 100),
          display: `${avgIV.toFixed(1)}%`,
          barColor: "bg-amber-500",
        };
      case "gamma":
        const totGamma = r.ce_gamma + r.pe_gamma;
        return {
          pct: Math.min(100, (totGamma / maxValues.mGamma) * 100),
          display: totGamma.toFixed(4),
          barColor: "bg-fuchsia-500",
        };
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Header & Switchers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              <span>🗺️</span> Options Liquidity &amp; Reaction Ladder
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold">
              Quantitative 0–100
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Vertical structure mapping major positioning zones. Click any level to inspect contributing metrics.
          </p>
        </div>

        {/* Switchers */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-xl overflow-x-auto text-xs font-bold">
          {[
            { id: "score", label: "⭐ Liquidity Score" },
            { id: "oi", label: "📊 OI Concentration" },
            { id: "doi", label: "⚡ ΔOI Change" },
            { id: "volume", label: "📈 Volume" },
            { id: "iv", label: "🌊 IV Smile" },
            { id: "gamma", label: "🔬 Gamma Risk" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id as LiquidityMetric)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
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

      {/* Vertical Ladder */}
      <div className="space-y-1.5 max-w-4xl mx-auto">
        {ladder.map((r) => {
          const isATM = r.strike === atmStrike;
          const isCallWall = r.strike === callWall;
          const isPutWall = r.strike === putWall;
          const isMaxPain = r.strike === maxPain;
          const data = getMetricData(r);

          let tag = r.liquidity_tag || "";
          if (isATM) tag = "CURRENT / ATM";
          else if (isCallWall) tag = "Call Wall (Major Resistance)";
          else if (isPutWall) tag = "Put Wall (Major Support)";
          else if (isMaxPain) tag = "Max Pain Anchor";

          return (
            <div
              key={r.strike}
              onClick={() => {
                setSelectedRow(r);
                if (onSelectStrike) onSelectStrike(r.strike);
              }}
              className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                isATM
                  ? "bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15 ring-1 ring-amber-500/30"
                  : isCallWall
                  ? "bg-blue-500/8 border-blue-500/30 hover:bg-blue-500/12"
                  : isPutWall
                  ? "bg-orange-500/8 border-orange-500/30 hover:bg-orange-500/12"
                  : "bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700"
              }`}
            >
              {/* Strike Number */}
              <div className="w-20 text-right font-mono font-black text-sm tracking-tight text-white flex-shrink-0">
                {fmt(r.strike)}
              </div>

              {/* Tag Label */}
              <div className="w-44 flex-shrink-0">
                {tag ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block truncate max-w-full ${
                      isATM
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : isCallWall
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                        : isPutWall
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                        : tag.includes("Liquidity")
                        ? "bg-violet-500/20 text-violet-400 border-violet-500/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    {tag}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600">—</span>
                )}
              </div>

              {/* Horizontal Intensity Bar */}
              <div className="flex-1 bg-zinc-900 h-4 rounded-md overflow-hidden relative border border-zinc-800">
                <div
                  className={`h-full rounded-md transition-all duration-300 ${data.barColor}`}
                  style={{ width: `${Math.max(2, data.pct)}%` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-mono font-bold text-zinc-300">
                  {data.display}
                </span>
              </div>

              {/* Score Badge */}
              <div className="w-16 text-right font-mono text-xs font-bold text-zinc-400 group-hover:text-white flex-shrink-0">
                {r.liquidity_score ? `${Math.round(r.liquidity_score)} pts` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inspection Modal / Popover */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  Quantitative Level Analysis
                </span>
                <h3 className="text-xl font-black text-white">Strike {fmt(selectedRow.strike)}</h3>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-zinc-400 hover:text-white text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-violet-500/10 border border-violet-500/25 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Overall Liquidity Score</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Derived multi-factor positioning score
                </div>
              </div>
              <div className="text-2xl font-black text-violet-400 font-mono">
                {selectedRow.liquidity_score || 0}
                <span className="text-xs text-zinc-400 font-normal">/100</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Contributing Factor Inputs
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Total Open Interest</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {fmt(selectedRow.ce_oi + selectedRow.pe_oi)} contracts
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Net Change in OI</div>
                  <div className="font-mono font-bold text-emerald-400 mt-0.5">
                    {selectedRow.ce_doi + selectedRow.pe_doi >= 0 ? "+" : ""}
                    {fmt(selectedRow.ce_doi + selectedRow.pe_doi)}
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Combined Volume</div>
                  <div className="font-mono font-bold text-white mt-0.5">
                    {fmt(selectedRow.ce_volume + selectedRow.pe_volume)}
                  </div>
                </div>
                <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">Distance from ATM</div>
                  <div className="font-mono font-bold text-yellow-400 mt-0.5">
                    {fmt(Math.abs(selectedRow.strike - atmStrike))} pts
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
              ℹ️ <strong>Methodology:</strong> Calculated quantitatively as: 35% OI concentration + 25% ΔOI buildup + 20% volume concentration + 10% ATM proximity + 10% gamma risk. Labeled as an estimated reaction zone; not a guarantee of execution or order fill.
            </div>

            <button
              onClick={() => setSelectedRow(null)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
