"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import Link from "next/link";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import { MainLayout } from "@/components/layout/MainLayout";
import { getDMAStockDetail, type StockDetailResponse } from "@/lib/api";

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDMAStockDetail(symbol);
      setDetail(data);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch stock details");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Main Interactive Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || !detail || !detail.chart_data || detail.chart_data.length === 0) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "#0f0f0f" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#1f1f23" }, horzLines: { color: "#1f1f23" } },
      width: container.clientWidth,
      height: 440,
      timeScale: { timeVisible: false, borderColor: "#27272a" },
      rightPriceScale: { borderColor: "#27272a" },
      crosshair: {
        mode: 1,
        vertLine: { color: "#52525b", width: 1, style: 3 },
        horzLine: { color: "#52525b", width: 1, style: 3 },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a", priceFormat: { type: "volume" }, priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const sma50Series = chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 2 });
    const sma200Series = chart.addSeries(LineSeries, { color: "#a855f7", lineWidth: 2 });

    // Format candlestick data
    const cData = detail.chart_data.map((d) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    const vData = detail.chart_data.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? "#10b98144" : "#ef444444",
    }));

    // @ts-ignore
    candleSeries.setData(cData);
    // @ts-ignore
    volumeSeries.setData(vData);

    // Overlay price lines for S1 & R1
    if (detail.supports && detail.supports[0]) {
      const s1Line = chart.addSeries(LineSeries, { color: "#10b98188", lineWidth: 1, lineStyle: 2 });
      // @ts-ignore
      s1Line.setData(cData.map((d) => ({ time: d.time, value: detail.supports[0].price })));
    }
    if (detail.resistances && detail.resistances[0]) {
      const r1Line = chart.addSeries(LineSeries, { color: "#ef444488", lineWidth: 1, lineStyle: 2 });
      // @ts-ignore
      r1Line.setData(cData.map((d) => ({ time: d.time, value: detail.resistances[0].price })));
    }

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); };
  }, [detail]);

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-950/90 text-emerald-400 border-emerald-800";
    if (score >= 65) return "bg-blue-950/90 text-blue-400 border-blue-800";
    return "bg-amber-950/90 text-amber-400 border-amber-800";
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <Link
              href="/dma-screener"
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
            >
              ← Back
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-wide text-white">{symbol}</h1>
                {detail && (
                  <span className="text-2xl font-bold text-white">₹{detail.price.toFixed(2)}</span>
                )}
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-800">
                  REAL MARKET DATA
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1">NSE Equity · Live Candles &amp; Support/Resistance Matrix</p>
            </div>
          </div>

          {detail && (
            <div className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${getScoreBadge(detail.dma_metrics.score)}`}>
              <span>SETUP SCORE:</span>
              <span className="text-lg">{detail.dma_metrics.score.toFixed(0)} / 100</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-6 bg-red-950/40 border border-red-800 text-red-300 text-sm rounded-2xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-zinc-400 text-sm">Calculating DMAs, Support/Resistance &amp; Volume Profile…</p>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Confluence Alert Banner */}
            {detail.confluence_tags.length > 0 && (
              <div className="bg-gradient-to-r from-blue-950/90 via-zinc-900 to-indigo-950/90 border border-blue-800/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                  <span>🔥 TECHNICAL CONFLUENCE DETECTED:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.confluence_tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-0.5 bg-blue-900/80 border border-blue-700 text-white text-xs font-medium rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-zinc-400 text-xs">
                  Multiple independent technical signals aligned
                </span>
              </div>
            )}

            {/* DMA Technical Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">20 DMA</span>
                <span className="text-lg font-bold text-blue-400">₹{detail.dma_metrics.dma20.toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">50 DMA</span>
                <span className="text-lg font-bold text-emerald-400">₹{detail.dma_metrics.dma50.toFixed(2)}</span>
                <span className="text-[11px] text-zinc-400 block">{detail.dma_metrics.dma50_slope_trend} ({detail.dma_metrics.dma50_slope}%)</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">200 DMA</span>
                <span className="text-lg font-bold text-purple-400">₹{detail.dma_metrics.dma200.toFixed(2)}</span>
                <span className="text-[11px] text-zinc-400 block">{detail.dma_metrics.dma200_slope_trend} ({detail.dma_metrics.dma200_slope}%)</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">RSI (14)</span>
                <span className="text-lg font-bold text-white">{detail.dma_metrics.rsi}</span>
                <span className="text-[11px] text-zinc-400 block">{detail.dma_metrics.rsi >= 50 ? "Bullish zone" : "Neutral"}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">Volume Multiplier</span>
                <span className="text-lg font-bold text-amber-400">{detail.dma_metrics.volume_mult}x</span>
                <span className="text-[11px] text-zinc-400 block">vs 20d avg</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <span className="text-xs text-zinc-500 block uppercase">50/200 Trend</span>
                <span className={`text-sm font-bold block mt-1 ${detail.dma_metrics.is_golden_cross ? "text-emerald-400" : "text-red-400"}`}>
                  {detail.dma_metrics.is_golden_cross ? "Golden Cross ✨" : "Death Cross"}
                </span>
              </div>
            </div>

            {/* Main Layout: Left Chart + Right Support/Resistance Matrix */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Interactive Price Chart */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-zinc-200">📈 Interactive Price Chart &amp; DMA Overlays</h3>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 50 DMA
                      </span>
                      <span className="flex items-center gap-1 text-purple-400">
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> 200 DMA
                      </span>
                    </div>
                  </div>
                  <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
                </div>
              </div>

              {/* Right Column: Support & Resistance Matrix & Volume Profile */}
              <div className="space-y-6">
                {/* Support & Resistance Levels Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-base font-bold text-white border-b border-zinc-800 pb-3 flex items-center justify-between">
                    <span>🎯 Support &amp; Resistance Matrix</span>
                    <span className="text-xs text-zinc-400 font-normal">Calculated Level Strengths</span>
                  </h3>

                  {/* Resistances (R3, R2, R1) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">Resistances</span>
                    {detail.resistances.length === 0 ? (
                      <p className="text-xs text-zinc-500">No major resistance zones detected above</p>
                    ) : (
                      detail.resistances.map((r) => (
                        <div key={r.label} className="bg-zinc-950/80 border border-red-950 p-3 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-red-400">{r.label} — ₹{r.price.toFixed(2)}</span>
                            <span className="text-red-300">+{r.distance_pct}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-red-500 h-full rounded-full" style={{ width: `${r.strength}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Strength: {r.strength.toFixed(0)}/100</span>
                            <span>{r.reasons.join(" · ")}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Current Price Divider */}
                  <div className="bg-zinc-800/80 p-2.5 rounded-xl text-center text-xs font-bold text-zinc-200 border border-zinc-700">
                    ▲ Current Price: ₹{detail.price.toFixed(2)}
                  </div>

                  {/* Supports (S1, S2, S3) */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Supports</span>
                    {detail.supports.length === 0 ? (
                      <p className="text-xs text-zinc-500">No major support zones detected below</p>
                    ) : (
                      detail.supports.map((s) => (
                        <div key={s.label} className="bg-zinc-950/80 border border-emerald-950 p-3 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-emerald-400">{s.label} — ₹{s.price.toFixed(2)}</span>
                            <span className="text-emerald-300">{s.distance_pct}%</span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${s.strength}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400">
                            <span>Strength: {s.strength.toFixed(0)}/100</span>
                            <span>{s.reasons.join(" · ")}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Volume Profile Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                    📊 Volume Profile Nodes
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-zinc-950 p-2.5 rounded-xl">
                      <span className="text-zinc-500 block">POC</span>
                      <span className="font-bold text-amber-400">₹{detail.volume_profile.poc.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-xl">
                      <span className="text-zinc-500 block">VAH</span>
                      <span className="font-bold text-red-400">₹{detail.volume_profile.vah.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-xl">
                      <span className="text-zinc-500 block">VAL</span>
                      <span className="font-bold text-emerald-400">₹{detail.volume_profile.val.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
