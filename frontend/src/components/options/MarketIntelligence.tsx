"use client";

import React from "react";

interface MarketIntelligenceProps {
  marketRegime: string;
  positioning: string;
  positioningDetails?: {
    price_pct?: string;
    oi_pct?: string;
    volume_delta?: string;
  };
  volatilityRegime: string;
  ivAvg: number;
  expectedMove: number;
  expectedMoveRange: number[];
  putWall: number;
  atmStrike: number;
  callWall: number;
  maxPain: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

export function MarketIntelligence({
  marketRegime,
  positioning,
  positioningDetails,
  volatilityRegime,
  ivAvg,
  expectedMove,
  expectedMoveRange,
  putWall,
  atmStrike,
  callWall,
  maxPain,
}: MarketIntelligenceProps) {
  const regimeBg = marketRegime.includes("BULL")
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : marketRegime.includes("BEAR")
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-amber-500/15 text-amber-400 border-amber-500/30";

  const posColor = positioning.includes("Long Buildup") || positioning.includes("Short Covering")
    ? "text-emerald-400"
    : positioning.includes("Short Buildup") || positioning.includes("Unwinding")
    ? "text-red-400"
    : "text-zinc-300";

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 text-sm">⚡</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Market Intelligence &amp; Positioning
          </h3>
        </div>
        <span className="text-[10px] text-zinc-500 font-medium">Quantitative Derived Feed</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Market Regime */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            Market Regime
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${regimeBg}`}>
              {marketRegime.replace("_", " ")}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2">
            Derived from aggregate Put/Call OI skew &amp; delta bias.
          </div>
        </div>

        {/* 2. Positioning */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            Positioning Pattern
          </div>
          <div className={`text-sm font-black ${posColor}`}>
            {positioning}
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400 font-mono">
            <span className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              Price: {positioningDetails?.price_pct || "+0.4%"}
            </span>
            <span className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
              OI: {positioningDetails?.oi_pct || "+1.8%"}
            </span>
          </div>
        </div>

        {/* 3. Volatility */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            Volatility &amp; Expected Move
          </div>
          <div className="text-sm font-black text-white">
            {volatilityRegime} Volatility <span className="text-violet-400 text-xs font-bold">({ivAvg.toFixed(1)}% IV)</span>
          </div>
          <div className="text-[10px] text-cyan-400/90 font-mono mt-1.5">
            Range: {expectedMoveRange.length === 2 ? `${fmt(expectedMoveRange[0])} — ${fmt(expectedMoveRange[1])}` : `±${expectedMove}`}
          </div>
        </div>

        {/* 4. Key Structural Levels */}
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3">
          <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            Key Positioning Levels
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
              <span className="text-orange-400/80 font-medium">Put Wall</span>
              <span className="text-white font-mono font-bold">{fmt(putWall)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
              <span className="text-yellow-400/80 font-medium">ATM</span>
              <span className="text-white font-mono font-bold">{fmt(atmStrike)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
              <span className="text-blue-400/80 font-medium">Call Wall</span>
              <span className="text-white font-mono font-bold">{fmt(callWall)}</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
              <span className="text-fuchsia-400/80 font-medium">Max Pain</span>
              <span className="text-white font-mono font-bold">{fmt(maxPain)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
