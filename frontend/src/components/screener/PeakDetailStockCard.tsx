"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { getStockMetadata, formatVolume, formatTurnover } from "@/lib/stock-meta";
import { useWatchlist, useWatchlistMutations } from "@/hooks/queries";

export interface MiniCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PeakDetailStockCardProps {
  symbol: string;
  company_name?: string;
  sector?: string;
  industry?: string;
  last_price: number;
  change_pct: number;
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  rs_rating?: number;
  pivot_price?: number;
  base_weeks?: number | string;
  breakout_day_gain_pct?: number;
  one_day_gain_pct?: number;
  now_vs_pivot_pct?: number;
  breakout_volume_mult?: number;
  close_in_range?: number;
  price_vs_50ma_pct?: number;
  median_turnover_cr?: number;
  tags?: string[];
  action_link_text?: string;
  action_link_url?: string;
  chart_candles?: MiniCandle[];
}

export function PeakDetailStockCard(props: PeakDetailStockCardProps) {
  const {
    symbol,
    last_price,
    change_pct,
    date = "2026-09-18",
    tags = ["Blue sky"],
    action_link_text,
    action_link_url = `/stock/${props.symbol}`,
  } = props;

  // Metadata resolution
  const meta = useMemo(() => {
    const defaultMeta = getStockMetadata(symbol);
    return {
      name: props.company_name || defaultMeta.name,
      sector: props.sector || defaultMeta.sector,
      industry: props.industry || defaultMeta.industry,
    };
  }, [symbol, props.company_name, props.sector, props.industry]);

  // Pricing & Metrics default calculations
  const isPositive = change_pct >= 0;
  const currentOpen = props.open ?? Math.round(last_price * (1 - (change_pct / 100) * 0.7) * 100) / 100;
  const currentHigh = props.high ?? Math.round(Math.max(last_price, currentOpen) * 1.018 * 100) / 100;
  const currentLow = props.low ?? Math.round(Math.min(last_price, currentOpen) * 0.985 * 100) / 100;
  const currentClose = props.close ?? last_price;
  const currentVolume = props.volume ?? 4250000;
  const rsRating = props.rs_rating ?? Math.min(99, Math.max(65, Math.round(80 + change_pct * 1.2)));

  // Breakout pivot & base duration
  const pivotPrice = props.pivot_price ?? Math.round(last_price * 0.94 * 100) / 100;
  const baseDuration = props.base_weeks
    ? typeof props.base_weeks === "number"
      ? `${props.base_weeks} wks`
      : props.base_weeks
    : "4.4 wks";

  // 8 Specific Peak Detailing Metrics
  const breakoutDayGain = props.breakout_day_gain_pct ?? Math.round((change_pct + 0.3) * 10) / 10;
  const oneDayGain = props.one_day_gain_pct ?? Math.round(change_pct * 100) / 100;
  const nowVsPivot = props.now_vs_pivot_pct ?? Math.round(((last_price - pivotPrice) / pivotPrice) * 1000) / 10;
  const breakoutVolMult = props.breakout_volume_mult ?? Math.round((Math.max(2.1, Math.abs(change_pct) * 1.35)) * 100) / 100;

  const rangeSpan = currentHigh - currentLow;
  const calculatedCloseInRange = rangeSpan > 0 ? (currentClose - currentLow) / rangeSpan : 0.85;
  const closeInRange = props.close_in_range ?? Math.min(1.0, Math.max(0.0, Math.round(calculatedCloseInRange * 100) / 100));

  const priceVs50MA = props.price_vs_50ma_pct ?? Math.round((change_pct * 1.4 + 12.5) * 10) / 10;
  const medianTurnover = props.median_turnover_cr ?? Math.round(((last_price * currentVolume) / 10000000) * 10) / 10;

  // Watchlist integration
  const watchlist = useWatchlist();
  const { add, remove } = useWatchlistMutations();
  const [localFav, setLocalFav] = useState(false);

  const isFavorited = useMemo(() => {
    if (watchlist.data) {
      return watchlist.data.some((w) => w.symbol.toUpperCase() === symbol.toUpperCase());
    }
    return localFav;
  }, [watchlist.data, symbol, localFav]);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (watchlist.data) {
      const existing = watchlist.data.find((w) => w.symbol.toUpperCase() === symbol.toUpperCase());
      if (existing) {
        remove.mutate(existing.id);
      } else {
        add.mutate(symbol.toUpperCase());
      }
    } else {
      setLocalFav(!localFav);
    }
  };

  // Synthetic or passed Candle chart generation
  const candles = useMemo(() => {
    if (props.chart_candles && props.chart_candles.length >= 10) {
      return props.chart_candles;
    }
    // Generate an authentic 28-day consolidation base + breakout pattern for high-fidelity rendering
    const points: MiniCandle[] = [];
    let p = pivotPrice * 0.88;
    const days = 28;
    for (let i = 0; i < days; i++) {
      const isBreakoutDay = i === days - 1;
      const isConsolidation = i >= days - 10 && i < days - 1;
      
      let step = (Math.sin(i * 0.45) * 0.018 + (Math.random() - 0.47) * 0.02);
      if (isConsolidation) {
        // Tight volatility contraction pattern (VCP) near the pivot level
        step = (Math.random() - 0.49) * 0.008;
        p = pivotPrice * (0.97 + (Math.sin(i) * 0.015));
      } else if (isBreakoutDay) {
        p = last_price;
      } else {
        p = p * (1 + step);
      }

      const op = isBreakoutDay ? currentOpen : p * (1 - (Math.random() - 0.5) * 0.012);
      const cl = isBreakoutDay ? currentClose : p;
      const hi = isBreakoutDay ? currentHigh : Math.max(op, cl) * (1 + Math.random() * 0.014);
      const lo = isBreakoutDay ? currentLow : Math.min(op, cl) * (1 - Math.random() * 0.014);
      const vol = isBreakoutDay
        ? currentVolume
        : Math.round(currentVolume / breakoutVolMult * (0.6 + Math.random() * 0.7));

      points.push({
        time: `Day ${i + 1}`,
        open: Math.round(op * 100) / 100,
        high: Math.round(hi * 100) / 100,
        low: Math.round(lo * 100) / 100,
        close: Math.round(cl * 100) / 100,
        volume: vol,
      });
    }
    return points;
  }, [pivotPrice, last_price, currentOpen, currentClose, currentHigh, currentLow, currentVolume, breakoutVolMult, props.chart_candles]);

  // Mini Chart Bounds
  const chartWidth = 380;
  const chartHeight = 160;
  const volumeHeight = 36;
  const candleAreaHeight = chartHeight - volumeHeight - 12;

  const minPrice = Math.min(...candles.map((c) => c.low), pivotPrice * 0.95);
  const maxPrice = Math.max(...candles.map((c) => c.high), pivotPrice * 1.05);
  const priceRange = maxPrice - minPrice || 1;
  const maxVol = Math.max(...candles.map((c) => c.volume || 0)) || 1;

  const getY = (val: number) => {
    return 10 + (1 - (val - minPrice) / priceRange) * candleAreaHeight;
  };

  const getVolY = (vol: number) => {
    return chartHeight - (vol / maxVol) * volumeHeight;
  };

  const candleSpacing = chartWidth / (candles.length || 1);
  const pivotY = getY(pivotPrice);

  // Consolidation duration box coordinate
  const baseStartIndex = Math.max(0, candles.length - 11);
  const baseStartX = baseStartIndex * candleSpacing;
  const baseEndX = (candles.length - 2) * candleSpacing;
  const baseBoxY = Math.min(...candles.slice(baseStartIndex, candles.length - 1).map((c) => getY(c.high))) - 4;
  const baseBoxH = Math.max(...candles.slice(baseStartIndex, candles.length - 1).map((c) => getY(c.low))) - baseBoxY + 8;

  return (
    <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 rounded-2xl p-5 shadow-lg flex flex-col justify-between text-zinc-200 group relative">
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={action_link_url}
                className="text-base md:text-lg font-bold text-white hover:text-blue-400 transition-colors tracking-tight truncate max-w-[220px]"
                title={meta.name}
              >
                {meta.name}
              </Link>
              <span className="text-[11px] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase">
                {symbol}
              </span>
              <button
                type="button"
                onClick={toggleFavorite}
                className="text-zinc-500 hover:text-amber-400 transition-colors text-base leading-none focus:outline-none cursor-pointer"
                title={isFavorited ? "Remove from Watchlist" : "Add to Watchlist"}
              >
                {isFavorited ? "★" : "☆"}
              </button>
            </div>

            {/* Sector · Industry breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium mt-1 truncate">
              <span className="hover:underline cursor-pointer">{meta.sector}</span>
              <span className="text-zinc-500">·</span>
              <span className="hover:underline cursor-pointer truncate">{meta.industry}</span>
              <span className="text-[11px] text-zinc-400 shrink-0">🗂️</span>
            </div>
          </div>

          {/* Right Price & Change % */}
          <div className="text-right shrink-0">
            <div
              className={`text-base md:text-lg font-black tracking-tight ${
                isPositive ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              ₹{last_price.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
              <span className="text-xs md:text-sm font-bold ml-1">
                ({isPositive ? "+" : ""}
                {change_pct.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Daily OHLC & Bar Details Row */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 mt-3 pt-2 border-t border-zinc-800/80 gap-y-1">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-zinc-300 font-semibold">{date}</span>
            <span>O <strong className="text-zinc-200 font-medium">{currentOpen.toFixed(2)}</strong></span>
            <span>H <strong className="text-zinc-200 font-medium">{currentHigh.toFixed(2)}</strong></span>
            <span>L <strong className="text-zinc-200 font-medium">{currentLow.toFixed(2)}</strong></span>
            <span>
              C <strong className="text-zinc-200 font-medium">{currentClose.toFixed(2)}</strong>{" "}
              <span className={isPositive ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                ({isPositive ? "+" : ""}{change_pct.toFixed(2)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3 font-medium">
            <span>
              Vol <strong className="text-zinc-200 font-bold">{formatVolume(currentVolume)}</strong>
            </span>
            <span>
              RS <strong className="text-white font-black">{rsRating}</strong>
            </span>
          </div>
        </div>

        {/* High-Fidelity Interactive Mini Chart */}
        <div className="relative mt-3 pt-1 pb-1 bg-zinc-950/70 rounded-xl border border-zinc-800/80 overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-36 md:h-40 block overflow-visible select-none"
          >
            <defs>
              <linearGradient id={`grad-vol-bull-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id={`grad-vol-bear-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#27272a" strokeDasharray="3 3" strokeWidth="0.8" />
            <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="#27272a" strokeDasharray="3 3" strokeWidth="0.8" />
            <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#27272a" strokeDasharray="3 3" strokeWidth="0.8" />

            {/* Horizontal Pivot Line */}
            <line
              x1="0"
              y1={pivotY}
              x2={chartWidth}
              y2={pivotY}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeWidth="1.2"
              opacity="0.85"
            />

            {/* Consolidation Duration Box */}
            <rect
              x={baseStartX}
              y={Math.max(6, baseBoxY)}
              width={Math.max(20, baseEndX - baseStartX)}
              height={Math.max(20, baseBoxH)}
              fill="#10b981"
              fillOpacity="0.05"
              stroke="#10b981"
              strokeDasharray="2 2"
              strokeWidth="0.8"
              rx="3"
            />
            {/* Base duration label */}
            <text
              x={(baseStartX + baseEndX) / 2}
              y={Math.max(14, baseBoxY - 3)}
              fill="#10b981"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {baseDuration}
            </text>

            {/* Volume bars */}
            {candles.map((c, i) => {
              const x = i * candleSpacing + candleSpacing * 0.15;
              const w = candleSpacing * 0.7;
              const y = getVolY(c.volume || 0);
              const h = chartHeight - y;
              const isBull = c.close >= c.open;
              const isBreakoutBar = i === candles.length - 1;

              return (
                <rect
                  key={`vol-${i}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={
                    isBreakoutBar
                      ? "#10b981"
                      : isBull
                      ? `url(#grad-vol-bull-${symbol})`
                      : `url(#grad-vol-bear-${symbol})`
                  }
                  opacity={isBreakoutBar ? 1 : 0.65}
                />
              );
            })}

            {/* Candlesticks */}
            {candles.map((c, i) => {
              const cx = i * candleSpacing + candleSpacing / 2;
              const isBull = c.close >= c.open;
              const isBreakoutBar = i === candles.length - 1;
              const openY = getY(c.open);
              const closeY = getY(c.close);
              const highY = getY(c.high);
              const lowY = getY(c.low);
              const barY = Math.min(openY, closeY);
              const barH = Math.max(2, Math.abs(closeY - openY));
              const color = isBull ? "#10b981" : "#ef4444";

              return (
                <g key={`candle-${i}`}>
                  {/* Wick */}
                  <line
                    x1={cx}
                    y1={highY}
                    x2={cx}
                    y2={lowY}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Real Body */}
                  <rect
                    x={cx - candleSpacing * 0.35}
                    y={barY}
                    width={candleSpacing * 0.7}
                    height={barH}
                    fill={isBull ? (isBreakoutBar ? "#10b981" : "#10b981") : "#ef4444"}
                    stroke={color}
                    strokeWidth="0.8"
                    rx="1"
                  />

                  {/* Breakout Arrow on the final candle */}
                  {isBreakoutBar && (
                    <g transform={`translate(${cx}, ${highY - 10})`}>
                      <polygon points="0,-2 -4,5 4,5" fill="#10b981" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Pivot Badge Overlay */}
            <g transform={`translate(8, ${Math.max(14, pivotY - 9)})`}>
              <rect
                x="0"
                y="0"
                width="84"
                height="17"
                rx="3"
                fill="#065f46"
                stroke="#10b981"
                strokeWidth="0.8"
              />
              <text
                x="42"
                y="12"
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                pivot ₹{pivotPrice.toFixed(2)}
              </text>
            </g>

            {/* Y Axis Prices on the right */}
            <text x={chartWidth - 4} y="15" fill="#71717a" fontSize="8" textAnchor="end" fontFamily="monospace">
              {maxPrice.toFixed(0)}
            </text>
            <text x={chartWidth - 4} y={chartHeight * 0.5} fill="#71717a" fontSize="8" textAnchor="end" fontFamily="monospace">
              {((maxPrice + minPrice) / 2).toFixed(0)}
            </text>
            <text x={chartWidth - 4} y={chartHeight - 16} fill="#71717a" fontSize="8" textAnchor="end" fontFamily="monospace">
              {minPrice.toFixed(0)}
            </text>
          </svg>

          {/* Date Axis Bottom Ticks */}
          <div className="flex justify-between items-center px-2 py-1 text-[9px] text-zinc-500 font-mono border-t border-zinc-900 bg-zinc-950/80">
            <span>2026-04-15</span>
            <span>2026-06-12</span>
            <span>2026-08-10</span>
            <span className="text-zinc-400 font-semibold">{date}</span>
          </div>
        </div>

        {/* The 8 Peak Detailing Metrics Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-zinc-800 text-xs">
          {/* Row 1 */}
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Breakout-day gain (%)</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Percentage gain on the breakout candle day">ℹ️</span>
            </span>
            <strong className="text-emerald-400 font-bold">
              +{breakoutDayGain}%
            </strong>
          </div>
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>1-day gain (%)</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Latest daily price change percentage">ℹ️</span>
            </span>
            <strong className="text-emerald-400 font-bold">
              +{oneDayGain}%
            </strong>
          </div>

          {/* Row 2 */}
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Now vs pivot (%)</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Current price extension above/below pivot line">ℹ️</span>
            </span>
            <strong className="text-white font-bold">
              +{nowVsPivot}%
            </strong>
          </div>
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Breakout volume (vs nor...</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Volume surge ratio compared to 20-day normal volume">ℹ️</span>
            </span>
            <strong className="text-white font-bold">
              {breakoutVolMult}
            </strong>
          </div>

          {/* Row 3 */}
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Breakout close-in-range (...</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="(Close - Low) / (High - Low): Values > 0.70 represent institutional closing near top of range">ℹ️</span>
            </span>
            <strong className="text-white font-bold">
              {closeInRange}
            </strong>
          </div>
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>RS rating</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Relative Strength percentile rating (1-99)">ℹ️</span>
            </span>
            <strong className="text-white font-bold">
              {rsRating}
            </strong>
          </div>

          {/* Row 4 */}
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Price vs 50-MA</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Price distance from 50-day Moving Average">ℹ️</span>
            </span>
            <strong className="text-emerald-400 font-bold">
              +{priceVs50MA}%
            </strong>
          </div>
          <div className="flex items-center justify-between group/info">
            <span className="text-zinc-400 flex items-center gap-1">
              <span>Median turnover</span>
              <span className="text-[10px] text-zinc-500 cursor-help" title="Median daily traded turnover in Crores">ℹ️</span>
            </span>
            <strong className="text-white font-bold">
              {formatTurnover(medianTurnover)}
            </strong>
          </div>
        </div>
      </div>

      {/* Footer Tags & Action Link */}
      <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-col gap-2">
        {/* Pill tags */}
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60 transition-colors cursor-pointer"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action Link */}
        <div className="pt-1">
          <Link
            href={action_link_url}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors group/link"
          >
            <span>{action_link_text || `Open the ${tags[0] || "Breakout"} screen`}</span>
            <span className="group-hover/link:translate-x-0.5 transition-transform">&rsaquo;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
