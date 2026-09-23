"use client";

import React, { useState } from "react";

interface SummaryCardsProps {
  spot: number;
  symbol: string;
  atmStrike: number;
  pcr: number;
  ivAvg: number;
  expectedMove: number;
  expectedMoveRange: number[];
  maxPain: number;
  callWall: number;
  putWall: number;
  marketBias: string;
  expiry: string;
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

interface CardDef {
  label: string;
  value: string;
  sub: string;
  color: string;
  tooltip: string;
}

export function SummaryCards({
  spot,
  symbol,
  atmStrike,
  pcr,
  ivAvg,
  expectedMove,
  expectedMoveRange,
  maxPain,
  callWall,
  putWall,
  marketBias,
  expiry,
}: SummaryCardsProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const biasColor = marketBias.includes("BULL")
    ? "text-emerald-400"
    : marketBias.includes("BEAR")
    ? "text-red-400"
    : "text-amber-400";

  const cards: CardDef[] = [
    {
      label: "SPOT",
      value: `₹${fmt(spot, 2)}`,
      sub: symbol,
      color: "text-white",
      tooltip: "Current spot underlying cash index price.",
    },
    {
      label: "ATM STRIKE",
      value: fmt(atmStrike),
      sub: "At-The-Money",
      color: "text-amber-400",
      tooltip: "The strike closest to the underlying spot price.",
    },
    {
      label: "PCR",
      value: pcr.toFixed(3),
      sub: pcr > 1.1 ? "PE > CE (Supportive)" : pcr < 0.9 ? "CE > PE (Defensive)" : "Neutral Range",
      color: pcr > 1.1 ? "text-emerald-400" : pcr < 0.9 ? "text-red-400" : "text-zinc-300",
      tooltip: "Put-Call Ratio: Total Put OI divided by Total Call OI. > 1.1 signals put writing support.",
    },
    {
      label: "AVG IV",
      value: `${ivAvg.toFixed(1)}%`,
      sub: "ATM Implied Vol",
      color: "text-violet-400",
      tooltip: "Average implied volatility across active ATM strikes.",
    },
    {
      label: "EXPECTED MOVE",
      value: `±${fmt(expectedMove, 1)}`,
      sub: expectedMoveRange.length === 2 ? `${fmt(expectedMoveRange[0])} — ${fmt(expectedMoveRange[1])}` : "Derived from straddle",
      color: "text-cyan-400",
      tooltip: "Market-implied trading range for current expiry calculated from ATM straddle premium (0.85 × [ATM CE + PE]).",
    },
    {
      label: "MAX PAIN",
      value: fmt(maxPain),
      sub: "Payout Anchor",
      color: "text-fuchsia-400",
      tooltip: "The strike where option buyers lose the most capital and option sellers have minimum payout.",
    },
    {
      label: "CALL WALL",
      value: fmt(callWall),
      sub: "Major Resistance",
      color: "text-blue-400",
      tooltip: "Strike with the highest Call Open Interest, indicating the primary overhead resistance wall.",
    },
    {
      label: "PUT WALL",
      value: fmt(putWall),
      sub: "Major Support",
      color: "text-orange-400",
      tooltip: "Strike with the highest Put Open Interest, indicating the primary downside support cushion.",
    },
    {
      label: "MARKET BIAS",
      value: marketBias.replace("_", " "),
      sub: expiry,
      color: biasColor,
      tooltip: "Quantitative bias derived from PCR, net OI delta, and positioning build-up.",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="relative bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700/80 rounded-xl p-3.5 flex flex-col justify-between transition-all group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase">
              {c.label}
            </span>
            <button
              type="button"
              onClick={() => setActiveTooltip(activeTooltip === c.label ? null : c.label)}
              onMouseEnter={() => setActiveTooltip(c.label)}
              onMouseLeave={() => setActiveTooltip(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs px-1 cursor-pointer"
              title="Metric Info"
            >
              ⓘ
            </button>
          </div>

          <div className={`text-base xl:text-lg font-black tracking-tight ${c.color} leading-none mb-1`}>
            {c.value}
          </div>

          <div className="text-[10px] text-zinc-500 truncate">{c.sub}</div>

          {activeTooltip === c.label && (
            <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-zinc-950/95 border border-zinc-700 text-zinc-300 text-[11px] leading-relaxed rounded-xl shadow-2xl pointer-events-none backdrop-blur-md">
              {c.tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-700" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
