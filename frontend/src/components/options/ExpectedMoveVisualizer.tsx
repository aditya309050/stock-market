"use client";

import React from "react";

interface ExpectedMoveVisualizerProps {
  spot: number;
  atmStrike: number;
  expectedMove: number;
  expectedMoveRange: number[];
  callWall: number;
  putWall: number;
  maxPain: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function ExpectedMoveVisualizer({
  spot,
  atmStrike,
  expectedMove,
  expectedMoveRange,
  callWall,
  putWall,
  maxPain,
}: ExpectedMoveVisualizerProps) {
  const low = expectedMoveRange[0] || (spot - expectedMove);
  const high = expectedMoveRange[1] || (spot + expectedMove);
  const totalSpan = Math.max(1, high - low);

  // Helper to compute percentage position along range [low, high]
  const toPct = (val: number) => {
    const raw = ((val - low) / totalSpan) * 100;
    return Math.max(2, Math.min(98, raw));
  };

  const markers = [
    { label: "Put Wall", value: putWall, color: "bg-orange-400 text-orange-400 border-orange-500/50", pos: toPct(putWall) },
    { label: "Spot", value: spot, color: "bg-white text-white border-white/50", pos: toPct(spot) },
    { label: "ATM", value: atmStrike, color: "bg-amber-400 text-amber-400 border-amber-500/50", pos: toPct(atmStrike) },
    { label: "Max Pain", value: maxPain, color: "bg-fuchsia-400 text-fuchsia-400 border-fuchsia-500/50", pos: toPct(maxPain) },
    { label: "Call Wall", value: callWall, color: "bg-blue-400 text-blue-400 border-blue-500/50", pos: toPct(callWall) },
  ];

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🎯</span> Expected Move Corridor
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              ±{fmt(expectedMove)} pts
            </span>
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Statistical range based on ATM option straddle pricing with key structural walls mapped.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
          <span>Lower Bound: <strong className="text-zinc-200">{fmt(low)}</strong></span>
          <span>•</span>
          <span>Upper Bound: <strong className="text-zinc-200">{fmt(high)}</strong></span>
        </div>
      </div>

      {/* Visual Track */}
      <div className="pt-8 pb-10 px-4">
        <div className="relative h-3 bg-zinc-950 rounded-full border border-zinc-800">
          {/* Active expected move gradient band */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 via-violet-500/30 to-cyan-500/20" />

          {/* Left Boundary Pin */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20" />
            <span className="absolute top-4 text-[10px] font-mono text-cyan-400 font-bold whitespace-nowrap">
              {fmt(low)}
            </span>
            <span className="absolute bottom-4 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold whitespace-nowrap">
              -1 EM
            </span>
          </div>

          {/* Right Boundary Pin */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20" />
            <span className="absolute top-4 text-[10px] font-mono text-cyan-400 font-bold whitespace-nowrap">
              {fmt(high)}
            </span>
            <span className="absolute bottom-4 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold whitespace-nowrap">
              +1 EM
            </span>
          </div>

          {/* Dynamic Structural Markers */}
          {markers.map((m, idx) => (
            <div
              key={m.label}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
              style={{ left: `${m.pos}%` }}
            >
              {/* Top Label (alternate vertical offset if needed) */}
              <span
                className={`absolute ${idx % 2 === 0 ? "bottom-4" : "bottom-7"} text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-zinc-950/90 whitespace-nowrap ${m.color}`}
              >
                {m.label}
              </span>

              {/* Pin */}
              <div className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${m.color.split(" ")[0]} shadow-md group-hover:scale-125 transition-transform`} />

              {/* Bottom Value */}
              <span
                className={`absolute ${idx % 2 === 0 ? "top-4" : "top-7"} text-[10px] font-mono font-bold whitespace-nowrap ${m.color.split(" ")[1]}`}
              >
                {fmt(m.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
