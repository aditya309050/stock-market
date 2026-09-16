"use client";

import { useEffect, useRef, useState, useCallback, use, useMemo } from "react";
import Link from "next/link";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { MainLayout } from "@/components/layout/MainLayout";
import { getDMAStockDetail, type StockDetailResponse } from "@/lib/api";

interface HoverCandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  dma20?: number | null;
  dma50?: number | null;
  dma200?: number | null;
}

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  const [detail, setDetail] = useState<StockDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // DMA Layer Visibility Toggles
  const [show20DMA, setShow20DMA] = useState(true);
  const [show50DMA, setShow50DMA] = useState(true);
  const [show200DMA, setShow200DMA] = useState(true);
  const [showSR, setShowSR] = useState(true);

  // Crosshair Hover Inspection State
  const [hoverData, setHoverData] = useState<HoverCandleData | null>(null);

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

  // Index candles by time string for fast crosshair lookup
  const candlesByTime = useMemo(() => {
    const map = new Map<string, any>();
    if (!detail?.chart_data) return map;
    for (const d of detail.chart_data) {
      map.set(d.time, d);
    }
    return map;
  }, [detail]);

  // Latest candle for default display when not hovering
  const latestCandle = useMemo(() => {
    if (!detail?.chart_data || detail.chart_data.length === 0) return null;
    return detail.chart_data[detail.chart_data.length - 1];
  }, [detail]);

  // Render Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || !detail || !detail.chart_data || detail.chart_data.length === 0) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0e" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#1a1a1d" },
        horzLines: { color: "#1a1a1d" },
      },
      width: container.clientWidth,
      height: 480,
      timeScale: {
        timeVisible: true,
        borderColor: "#27272a",
        rightOffset: 12,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: "#27272a",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#52525b", width: 1, style: 3 },
        horzLine: { color: "#52525b", width: 1, style: 3 },
      },
    });

    chartInstanceRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // 20 DMA Series (Blue)
    const sma20Series = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      title: "20 DMA",
      visible: show20DMA,
    });

    // 50 DMA Series (Emerald Green)
    const sma50Series = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 2,
      title: "50 DMA",
      visible: show50DMA,
    });

    // 200 DMA Series (Purple)
    const sma200Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      title: "200 DMA",
      visible: show200DMA,
    });

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
      color: d.close >= d.open ? "#10b98133" : "#ef444433",
    }));

    // Extract exact DMA points
    const sma20Data = detail.chart_data
      .filter((d) => d.dma20 !== null && d.dma20 !== undefined)
      .map((d) => ({ time: d.time, value: Number(d.dma20) }));

    const sma50Data = detail.chart_data
      .filter((d) => d.dma50 !== null && d.dma50 !== undefined)
      .map((d) => ({ time: d.time, value: Number(d.dma50) }));

    const sma200Data = detail.chart_data
      .filter((d) => d.dma200 !== null && d.dma200 !== undefined)
      .map((d) => ({ time: d.time, value: Number(d.dma200) }));

    // @ts-ignore
    candleSeries.setData(cData);
    // @ts-ignore
    volumeSeries.setData(vData);

    if (sma20Data.length > 0) {
      // @ts-ignore
      sma20Series.setData(sma20Data);
    }
    if (sma50Data.length > 0) {
      // @ts-ignore
      sma50Series.setData(sma50Data);
    }
    if (sma200Data.length > 0) {
      // @ts-ignore
      sma200Series.setData(sma200Data);
    }

    // Native TradingView S/R Price Lines
    if (showSR) {
      if (detail.supports && detail.supports[0]) {
        candleSeries.createPriceLine({
          price: detail.supports[0].price,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `S1 (${detail.supports[0].label || "Sup"}) ₹${detail.supports[0].price.toFixed(1)}`,
        });
      }
      if (detail.resistances && detail.resistances[0]) {
        candleSeries.createPriceLine({
          price: detail.resistances[0].price,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `R1 (${detail.resistances[0].label || "Res"}) ₹${detail.resistances[0].price.toFixed(1)}`,
        });
      }
    }

    // Subscribe to crosshair move for interactive HUD
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoverData(null);
        return;
      }
      const timeStr = typeof param.time === "string" ? param.time : (param.time as any).year ? `${(param.time as any).year}-${String((param.time as any).month).padStart(2, '0')}-${String((param.time as any).day).padStart(2, '0')}` : String(param.time);
      const row = candlesByTime.get(timeStr);
      if (row) {
        setHoverData({
          time: row.time,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
          dma20: row.dma20,
          dma50: row.dma50,
          dma200: row.dma200,
        });
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [detail, show20DMA, show50DMA, show200DMA, showSR, candlesByTime]);

  const activeDisplay = hoverData || latestCandle;

  const getScoreBadge = (score: number) => {
    if (score >= 80) return "bg-emerald-950/90 text-emerald-400 border-emerald-800";
    if (score >= 65) return "bg-blue-950/90 text-blue-400 border-blue-800";
    return "bg-amber-950/90 text-amber-400 border-amber-800";
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6 font-sans">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/golden-cross"
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
            >
              ← Back to Scanner
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-wide text-white">{symbol}</h1>
                {detail && (
                  <span className="text-2xl font-bold text-white">₹{detail.price.toFixed(2)}</span>
                )}
                <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 text-xs font-bold rounded-full border border-emerald-800">
                  REAL-TIME NSE MARKET FEED
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1">
                Official Daily Moving Averages (20 / 50 / 200 DMA) · Support &amp; Resistance Matrix
              </p>
            </div>
          </div>

          {detail && (
            <div className={`px-5 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-3 ${getScoreBadge(detail.dma_metrics.score)}`}>
              <span className="text-xs uppercase tracking-wider text-zinc-400">Setup Score:</span>
              <span className="text-xl font-extrabold">{detail.dma_metrics.score.toFixed(0)} / 100</span>
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
            <p className="text-zinc-400 text-sm">Calculating real 20, 50, and 200 DMAs &amp; Support/Resistance Matrix…</p>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Technical Confluence Banner */}
            {detail.confluence_tags.length > 0 && (
              <div className="bg-gradient-to-r from-blue-950/80 via-zinc-900 to-indigo-950/80 border border-blue-800/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                  <span>🔥 TECHNICAL CONFLUENCE DETECTED:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.confluence_tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-0.5 bg-blue-900/80 border border-blue-700 text-white text-xs font-semibold rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-zinc-400 text-xs">Multiple technical factors align on this scrip</span>
              </div>
            )}

            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {/* 20 DMA */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase">20 DMA</span>
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                </div>
                <span className="text-xl font-extrabold text-blue-400 block">
                  ₹{detail.dma_metrics.dma20.toFixed(2)}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {detail.price >= detail.dma_metrics.dma20 ? "+" : ""}
                  {(((detail.price - detail.dma_metrics.dma20) / detail.dma_metrics.dma20) * 100).toFixed(2)}% vs Price
                </span>
              </div>

              {/* 50 DMA */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase">50 DMA</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xl font-extrabold text-emerald-400 block">
                  ₹{detail.dma_metrics.dma50.toFixed(2)}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {detail.dma_metrics.dist_50_pct >= 0 ? "+" : ""}
                  {detail.dma_metrics.dist_50_pct.toFixed(2)}% · {detail.dma_metrics.dma50_slope_trend}
                </span>
              </div>

              {/* 200 DMA */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-400 uppercase">200 DMA</span>
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                </div>
                <span className="text-xl font-extrabold text-purple-400 block">
                  ₹{detail.dma_metrics.dma200.toFixed(2)}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {detail.dma_metrics.dist_200_pct >= 0 ? "+" : ""}
                  {detail.dma_metrics.dist_200_pct.toFixed(2)}% · {detail.dma_metrics.dma200_slope_trend}
                </span>
              </div>

              {/* RSI (14) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase block">RSI (14)</span>
                <span className="text-xl font-extrabold text-white block">
                  {detail.dma_metrics.rsi.toFixed(1)}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  {detail.dma_metrics.rsi >= 70 ? "Overbought" : detail.dma_metrics.rsi <= 30 ? "Oversold" : detail.dma_metrics.rsi >= 50 ? "Bullish zone" : "Neutral zone"}
                </span>
              </div>

              {/* Volume Multiplier */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase block">Vol Multiplier</span>
                <span className="text-xl font-extrabold text-amber-400 block">
                  {detail.dma_metrics.volume_mult.toFixed(2)}x
                </span>
                <span className="text-[11px] text-zinc-400 block">vs 20-day avg volume</span>
              </div>

              {/* 50 / 200 Cross State */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
                <span className="text-xs font-bold text-zinc-400 uppercase block">Cross State</span>
                <span className={`text-sm font-extrabold block mt-0.5 ${detail.dma_metrics.is_golden_cross ? "text-emerald-400" : "text-amber-400"}`}>
                  {detail.dma_metrics.is_golden_cross ? "Golden Cross ✨" : "Death Cross"}
                </span>
                <span className="text-[11px] text-zinc-400 block">
                  Gap: {detail.dma_metrics.gap_pct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Main Interactive Chart & Matrix */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Lightweight Price Chart */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4">
                  {/* Top Bar: Title & Toggle Switches */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      📈 Interactive Price Chart &amp; Original DMA Overlays
                    </h3>

                    {/* DMA Line Layer Toggles */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShow20DMA((v) => !v)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          show20DMA
                            ? "bg-blue-950/80 text-blue-300 border-blue-700 shadow-sm"
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700 opacity-60"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        20 DMA
                      </button>
                      <button
                        onClick={() => setShow50DMA((v) => !v)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          show50DMA
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-700 shadow-sm"
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700 opacity-60"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        50 DMA
                      </button>
                      <button
                        onClick={() => setShow200DMA((v) => !v)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          show200DMA
                            ? "bg-purple-950/80 text-purple-300 border-purple-700 shadow-sm"
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700 opacity-60"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                        200 DMA
                      </button>
                      <button
                        onClick={() => setShowSR((v) => !v)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          showSR
                            ? "bg-amber-950/80 text-amber-300 border-amber-700 shadow-sm"
                            : "bg-zinc-800/50 text-zinc-500 border-zinc-700 opacity-60"
                        }`}
                      >
                        S/R Levels
                      </button>
                    </div>
                  </div>

                  {/* Detailing Crosshair HUD */}
                  {activeDisplay && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-950/90 rounded-xl border border-zinc-800/80 text-xs font-mono">
                      <div className="flex flex-wrap items-center gap-3 text-zinc-300 font-sans">
                        <span className="font-bold text-white bg-zinc-800 px-2 py-0.5 rounded text-[11px]">
                          {activeDisplay.time}
                        </span>
                        <span><strong className="text-zinc-500">O:</strong> ₹{activeDisplay.open?.toFixed(2)}</span>
                        <span><strong className="text-zinc-500">H:</strong> ₹{activeDisplay.high?.toFixed(2)}</span>
                        <span><strong className="text-zinc-500">L:</strong> ₹{activeDisplay.low?.toFixed(2)}</span>
                        <span><strong className="text-zinc-500">C:</strong> ₹{activeDisplay.close?.toFixed(2)}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {activeDisplay.dma20 != null && show20DMA && (
                          <span className="text-blue-400 font-bold">
                            <span className="text-zinc-500 font-normal">20 DMA:</span> ₹{activeDisplay.dma20.toFixed(2)}
                          </span>
                        )}
                        {activeDisplay.dma50 != null && show50DMA && (
                          <span className="text-emerald-400 font-bold">
                            <span className="text-zinc-500 font-normal">50 DMA:</span> ₹{activeDisplay.dma50.toFixed(2)}
                          </span>
                        )}
                        {activeDisplay.dma200 != null && show200DMA && (
                          <span className="text-purple-400 font-bold">
                            <span className="text-zinc-500 font-normal">200 DMA:</span> ₹{activeDisplay.dma200.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chart DOM Container */}
                  <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden" />
                </div>
              </div>

              {/* Right Column: Support / Resistance & Volume Profile */}
              <div className="space-y-6">
                {/* Support & Resistance Matrix */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">🎯 Support &amp; Resistance Matrix</h3>
                    <span className="text-xs text-zinc-400">Validated Price Zones</span>
                  </div>

                  {/* Resistances */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">Resistances</span>
                    {detail.resistances.length === 0 ? (
                      <p className="text-xs text-zinc-500">No major resistance detected above</p>
                    ) : (
                      detail.resistances.map((r) => (
                        <div key={r.label} className="bg-zinc-950/80 border border-red-950/80 p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-red-400">{r.label} — ₹{r.price.toFixed(2)}</span>
                            <span className="text-red-300">+{r.distance_pct.toFixed(2)}%</span>
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

                  {/* Current Price Marker */}
                  <div className="bg-zinc-800/90 p-3 rounded-xl text-center text-xs font-bold text-white border border-zinc-700 shadow-sm">
                    ▲ Current Market Price: ₹{detail.price.toFixed(2)}
                  </div>

                  {/* Supports */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Supports</span>
                    {detail.supports.length === 0 ? (
                      <p className="text-xs text-zinc-500">No major support detected below</p>
                    ) : (
                      detail.supports.map((s) => (
                        <div key={s.label} className="bg-zinc-950/80 border border-emerald-950/80 p-3 rounded-xl space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-emerald-400">{s.label} — ₹{s.price.toFixed(2)}</span>
                            <span className="text-emerald-300">{s.distance_pct.toFixed(2)}%</span>
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

                {/* Volume Profile Nodes */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">
                    📊 Volume Profile Nodes
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px] uppercase font-semibold">POC</span>
                      <span className="font-bold text-amber-400 text-sm">₹{detail.volume_profile.poc.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px] uppercase font-semibold">VAH</span>
                      <span className="font-bold text-red-400 text-sm">₹{detail.volume_profile.vah.toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px] uppercase font-semibold">VAL</span>
                      <span className="font-bold text-emerald-400 text-sm">₹{detail.volume_profile.val.toFixed(2)}</span>
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
