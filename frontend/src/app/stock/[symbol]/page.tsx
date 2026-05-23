"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { use } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { MainLayout } from "@/components/layout/MainLayout";
import Link from "next/link";

type ChartData = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma50: number | null;
  sma200: number | null;
};

const TIMEFRAMES = [
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
] as const;

// Simple RSI calculation
function calcRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { rsi.push(null); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - closes[j - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) { rsi.push(100); continue; }
    const rs = avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

// Simple MACD calculation
function calcMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema = (data: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };

  if (closes.length < 26) return { macd: closes.map(() => null), signal: closes.map(() => null), histogram: closes.map(() => null) };

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine: (number | null)[] = [];
  const validMacd: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < 25) { macdLine.push(null); continue; }
    const val = ema12[i] - ema26[i];
    macdLine.push(val);
    validMacd.push(val);
  }

  const signalEma = ema(validMacd, 9);
  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  let signalIdx = 0;

  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null) {
      signal.push(null);
      histogram.push(null);
    } else {
      if (signalIdx < 8) {
        signal.push(null);
        histogram.push(null);
      } else {
        signal.push(signalEma[signalIdx]);
        histogram.push((macdLine[i] as number) - signalEma[signalIdx]);
      }
      signalIdx++;
    }
  }

  return { macd: macdLine, signal, histogram };
}

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const resolvedParams = use(params);
  const symbol = decodeURIComponent(resolvedParams.symbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState("1y");
  const [aiAnalysis, setAiAnalysis] = useState("");

  const fetchData = useCallback(async (tf: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/dma-screener/history/${symbol}?period=${tf}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const json: ChartData[] = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData(timeframe);
  }, [fetchData, timeframe]);

  // Main Price Chart
  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "#0f0f0f" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#1f1f23" }, horzLines: { color: "#1f1f23" } },
      width: container.clientWidth,
      height: 420,
      timeScale: { timeVisible: false, borderColor: "#27272a" },
      rightPriceScale: { borderColor: "#27272a" },
      crosshair: {
        mode: 1,
        vertLine: { color: "#52525b", width: 1, style: 3 },
        horzLine: { color: "#52525b", width: 1, style: 3 },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a", priceFormat: { type: "volume" }, priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    const sma50Series = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
    const sma200Series = chart.addLineSeries({ color: "#eab308", lineWidth: 2 });

    // @ts-ignore
    candleSeries.setData(data.map((d) => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
    // @ts-ignore
    volumeSeries.setData(data.map((d) => ({ time: d.time, value: d.volume, color: d.close > d.open ? "#10b98144" : "#ef444444" })));
    // @ts-ignore
    sma50Series.setData(data.filter((d) => d.sma50 !== null).map((d) => ({ time: d.time, value: d.sma50 })));
    // @ts-ignore
    sma200Series.setData(data.filter((d) => d.sma200 !== null).map((d) => ({ time: d.time, value: d.sma200 })));

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); };
  }, [data]);

  // RSI Chart
  useEffect(() => {
    if (!rsiContainerRef.current || data.length === 0) return;

    const container = rsiContainerRef.current;
    container.innerHTML = "";
    const closes = data.map((d) => d.close);
    const rsiValues = calcRSI(closes);

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "#0f0f0f" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#1f1f23" }, horzLines: { color: "#1f1f23" } },
      width: container.clientWidth,
      height: 120,
      timeScale: { timeVisible: false, borderColor: "#27272a" },
      rightPriceScale: { borderColor: "#27272a", scaleMargins: { top: 0.1, bottom: 0.1 } },
      crosshair: { mode: 1, vertLine: { color: "#52525b", width: 1, style: 3 }, horzLine: { color: "#52525b", width: 1, style: 3 } },
    });

    const rsiSeries = chart.addLineSeries({ color: "#a855f7", lineWidth: 2 });

    const rsiLine70 = chart.addLineSeries({ color: "#ef444466", lineWidth: 1, lineStyle: 2 });
    const rsiLine30 = chart.addLineSeries({ color: "#10b98166", lineWidth: 1, lineStyle: 2 });

    const rsiData = data.map((d, i) => ({ time: d.time, value: rsiValues[i] })).filter((d) => d.value !== null);
    // @ts-ignore
    rsiSeries.setData(rsiData);
    // @ts-ignore
    rsiLine70.setData(data.map((d) => ({ time: d.time, value: 70 })));
    // @ts-ignore
    rsiLine30.setData(data.map((d) => ({ time: d.time, value: 30 })));

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); };
  }, [data]);

  // MACD Chart
  useEffect(() => {
    if (!macdContainerRef.current || data.length === 0) return;

    const container = macdContainerRef.current;
    container.innerHTML = "";
    const closes = data.map((d) => d.close);
    const { macd: macdValues, signal: signalValues, histogram: histValues } = calcMACD(closes);

    const chart = createChart(container, {
      layout: { background: { type: ColorType.Solid, color: "#0f0f0f" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#1f1f23" }, horzLines: { color: "#1f1f23" } },
      width: container.clientWidth,
      height: 120,
      timeScale: { timeVisible: false, borderColor: "#27272a" },
      rightPriceScale: { borderColor: "#27272a" },
      crosshair: { mode: 1, vertLine: { color: "#52525b", width: 1, style: 3 }, horzLine: { color: "#52525b", width: 1, style: 3 } },
    });

    const macdSeries = chart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
    const signalSeries = chart.addLineSeries({ color: "#ef4444", lineWidth: 1 });
    const histSeries = chart.addHistogramSeries({ color: "#10b981" });

    const macdData = data.map((d, i) => ({ time: d.time, value: macdValues[i] })).filter((d) => d.value !== null);
    const sigData = data.map((d, i) => ({ time: d.time, value: signalValues[i] })).filter((d) => d.value !== null);
    const histData = data.map((d, i) => ({
      time: d.time,
      value: histValues[i],
      color: (histValues[i] || 0) >= 0 ? "#10b98188" : "#ef444488",
    })).filter((d) => d.value !== null);

    // @ts-ignore
    macdSeries.setData(macdData);
    // @ts-ignore
    signalSeries.setData(sigData);
    // @ts-ignore
    histSeries.setData(histData);

    chart.timeScale().fitContent();

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); chart.remove(); };
  }, [data]);

  // Generate AI analysis
  useEffect(() => {
    if (data.length < 50) { setAiAnalysis(""); return; }
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    const closes = data.map((d) => d.close);
    const rsiValues = calcRSI(closes);
    const currentRSI = rsiValues[rsiValues.length - 1];

    const avgVol = data.slice(-21, -1).reduce((s, d) => s + d.volume, 0) / 20;
    const volSpike = latest.volume / avgVol;

    let analysis = `${symbol} is currently trading at ₹${latest.close.toFixed(2)}. `;

    if (latest.sma50) {
      const distPct = Math.abs(latest.close - latest.sma50) / latest.sma50 * 100;
      if (distPct <= 2) {
        analysis += `The stock is trading very close to its 50 DMA (₹${latest.sma50.toFixed(2)}), just ${distPct.toFixed(1)}% away — this is a critical zone. `;
      } else if (latest.close > latest.sma50) {
        analysis += `The stock is ${distPct.toFixed(1)}% above its 50 DMA (₹${latest.sma50.toFixed(2)}), showing bullish momentum. `;
      } else {
        analysis += `The stock is ${distPct.toFixed(1)}% below its 50 DMA (₹${latest.sma50.toFixed(2)}). `;
      }
    }

    if (volSpike > 1.5) analysis += `There is a significant volume spike of ${volSpike.toFixed(1)}x the 20-day average, indicating strong participation. `;

    if (currentRSI !== null) {
      if (currentRSI > 70) analysis += `RSI is at ${currentRSI.toFixed(1)} — overbought territory; caution warranted. `;
      else if (currentRSI > 50) analysis += `RSI is at ${currentRSI.toFixed(1)} — bullish momentum building. `;
      else if (currentRSI > 30) analysis += `RSI is at ${currentRSI.toFixed(1)} — neutral zone. `;
      else analysis += `RSI is at ${currentRSI.toFixed(1)} — oversold, potential reversal zone. `;
    }

    if (latest.sma50 && latest.sma200) {
      if (latest.sma50 > latest.sma200) analysis += "The Golden Cross (50 DMA > 200 DMA) is active — long-term bullish structure. ";
      else analysis += "The Death Cross (50 DMA < 200 DMA) is present — long-term bearish pressure. ";
    }

    const priceChange = ((latest.close - prev.close) / prev.close * 100);
    if (priceChange > 2) analysis += `Today's move of +${priceChange.toFixed(1)}% is notable. Probability of breakout is HIGH.`;
    else if (priceChange > 0) analysis += "Overall setup looks constructive. Probability of breakout is MEDIUM.";
    else analysis += "Price action is cautious. Monitor for a confirmed bounce or breakdown.";

    setAiAnalysis(analysis);
  }, [data, symbol]);

  const latest = data.length > 0 ? data[data.length - 1] : null;
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const priceChange = latest && prev ? ((latest.close - prev.close) / prev.close * 100) : 0;

  return (
    <MainLayout>
      <div className="p-4 md:p-8 max-w-[90rem] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dma-screener" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              </Link>
              <h1 className="text-3xl font-bold">{symbol}</h1>
              {latest && (
                <>
                  <span className="text-2xl font-semibold text-white">₹{latest.close.toFixed(2)}</span>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${priceChange >= 0 ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
                    {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                  </span>
                </>
              )}
            </div>
            <p className="text-zinc-500 text-sm mt-1 ml-9">Consolidated · Daily Candles</p>
          </div>

          {/* Timeframe Selector */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  timeframe === tf.value
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 p-4 rounded-xl text-sm">{error}</div>
        )}

        {/* Key Metrics */}
        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "50 DMA", value: latest.sma50 ? `₹${latest.sma50.toFixed(2)}` : "—", color: "text-blue-400" },
              { label: "200 DMA", value: latest.sma200 ? `₹${latest.sma200.toFixed(2)}` : "—", color: "text-yellow-400" },
              { label: "Distance", value: latest.sma50 ? `${(Math.abs(latest.close - latest.sma50) / latest.sma50 * 100).toFixed(2)}%` : "—", color: latest.sma50 && Math.abs(latest.close - latest.sma50) / latest.sma50 * 100 <= 2 ? "text-emerald-400" : "text-zinc-300" },
              { label: "Volume", value: latest.volume.toLocaleString(), color: "text-zinc-300" },
              { label: "Trend", value: latest.sma50 && latest.sma200 ? (latest.sma50 > latest.sma200 ? "Golden Cross ✨" : "Death Cross") : "—", color: latest.sma50 && latest.sma200 && latest.sma50 > latest.sma200 ? "text-emerald-400" : "text-red-400" },
            ].map((m) => (
              <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">{m.label}</p>
                <p className={`text-lg font-bold mt-1 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-2">
            {/* Main Chart */}
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl relative">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/70 z-10">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <div className="absolute top-3 left-3 z-10 flex gap-3 text-xs font-medium">
                <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2.5 py-1 rounded-md backdrop-blur border border-zinc-800">
                  <div className="w-2.5 h-0.5 bg-blue-500 rounded"></div>
                  <span className="text-zinc-400">50 DMA</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-900/90 px-2.5 py-1 rounded-md backdrop-blur border border-zinc-800">
                  <div className="w-2.5 h-0.5 bg-yellow-500 rounded"></div>
                  <span className="text-zinc-400">200 DMA</span>
                </div>
              </div>
              <div ref={chartContainerRef} className="w-full" />
            </div>

            {/* RSI */}
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-2 left-3 z-10 text-xs font-semibold text-purple-400 bg-zinc-900/90 px-2 py-0.5 rounded backdrop-blur border border-zinc-800">RSI (14)</div>
              <div ref={rsiContainerRef} className="w-full" />
            </div>

            {/* MACD */}
            <div className="bg-[#0f0f0f] border border-zinc-800 rounded-xl overflow-hidden relative">
              <div className="absolute top-2 left-3 z-10 flex gap-2 text-xs font-semibold">
                <span className="text-blue-400 bg-zinc-900/90 px-2 py-0.5 rounded backdrop-blur border border-zinc-800">MACD</span>
                <span className="text-red-400 bg-zinc-900/90 px-2 py-0.5 rounded backdrop-blur border border-zinc-800">Signal</span>
              </div>
              <div ref={macdContainerRef} className="w-full" />
            </div>
          </div>

          {/* AI Analysis Sidebar */}
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-2 text-blue-400 mb-4 border-b border-zinc-800 pb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"></path></svg>
                <h3 className="font-bold text-lg">AI Analysis</h3>
              </div>

              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                  <div className="h-4 bg-zinc-800 rounded w-full"></div>
                  <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
                  <div className="h-4 bg-zinc-800 rounded w-2/3"></div>
                </div>
              ) : aiAnalysis ? (
                <p className="text-zinc-300 text-sm leading-relaxed">{aiAnalysis}</p>
              ) : (
                <p className="text-zinc-500 text-sm">Not enough data to analyze.</p>
              )}
            </div>

            {/* Quick Stats */}
            {latest && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h4 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">Quick Stats</h4>
                {[
                  { label: "Open", value: `₹${latest.open.toFixed(2)}` },
                  { label: "High", value: `₹${latest.high.toFixed(2)}` },
                  { label: "Low", value: `₹${latest.low.toFixed(2)}` },
                  { label: "Close", value: `₹${latest.close.toFixed(2)}` },
                  { label: "Volume", value: latest.volume.toLocaleString() },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-zinc-500">{s.label}</span>
                    <span className="text-zinc-200 font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
