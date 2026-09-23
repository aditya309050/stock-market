"use client";

import React from "react";

export interface EvidenceItem {
  title: string;
  strike: number;
  levelType: string;
  ceOI?: number;
  peOI?: number;
  doi?: number;
  volume?: number;
  distFromATM: number;
  score?: number;
  summary: string;
}

interface EvidenceModalProps {
  item: EvidenceItem | null;
  onClose: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function EvidenceModal({ item, onClose }: EvidenceModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
              Structural Level Evidence
            </span>
            <h3 className="text-xl font-black text-white">
              Strike {fmt(item.strike)} · {item.levelType}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-lg p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            Quantitative Evidence Breakdown:
          </div>
          <div className="space-y-1.5 text-xs">
            {item.ceOI !== undefined && (
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Call Open Interest:</span>
                <span className="font-mono font-bold text-blue-400">{fmtCompact(item.ceOI)} ({item.ceOI > 50000 ? "High Concentration" : "Moderate"})</span>
              </div>
            )}
            {item.peOI !== undefined && (
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Put Open Interest:</span>
                <span className="font-mono font-bold text-orange-400">{fmtCompact(item.peOI)} ({item.peOI > 50000 ? "High Support Floor" : "Moderate"})</span>
              </div>
            )}
            {item.doi !== undefined && (
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Net Change in OI:</span>
                <span className="font-mono font-bold text-emerald-400">{item.doi >= 0 ? "+" : ""}{fmtCompact(item.doi)}</span>
              </div>
            )}
            {item.volume !== undefined && (
              <div className="flex justify-between py-1 border-b border-zinc-800/60">
                <span className="text-zinc-400">Trading Volume:</span>
                <span className="font-mono font-bold text-white">{fmtCompact(item.volume)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-zinc-800/60">
              <span className="text-zinc-400">Distance from ATM:</span>
              <span className="font-mono font-bold text-yellow-400">{item.distFromATM} pts</span>
            </div>
            {item.score !== undefined && (
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Overall Liquidity Score:</span>
                <span className="font-mono font-bold text-violet-400">{item.score}/100</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-[11px] text-zinc-300 leading-relaxed">
          {item.summary}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Close Evidence
        </button>
      </div>
    </div>
  );
}
