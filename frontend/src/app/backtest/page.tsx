"use client";

import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  runBacktest,
  getBacktestPresets,
  type BacktestRequest,
  type BacktestResponse,
} from "@/lib/api";

export default function BacktestPage() {
  const [strategy, setStrategy] = useState("GOLDEN_CROSS");
  const [universe, setUniverse] = useState("NIFTY 50");
  const [customSymbol, setCustomSymbol] = useState("");
  const [lookbackYears, setLookbackYears] = useState(2);
  const [targetPct, setTargetPct] = useState(12.0);
  const [stopLossPct, setStopLossPct] = useState(5.0);
  const [rsiFilterMax, setRsiFilterMax] = useState(65.0);
  const [initialCapital, setInitialCapital] = useState(100000);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [filterTrades, setFilterTrades] = useState<"ALL" | "WINS" | "LOSSES">("ALL");

  const executeBacktest = async () => {
    setLoading(true);
    try {
      const payload: BacktestRequest = {
        strategy,
        universe,
        lookback_years: lookbackYears,
        target_pct: targetPct,
        stop_loss_pct: stopLossPct,
        rsi_filter_max: rsiFilterMax,
        initial_capital: initialCapital,
        custom_symbol: customSymbol.trim() || undefined,
      };
      const res = await runBacktest(payload);
      setResult(res);
    } catch (err) {
      console.error("Backtest failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeBacktest();
  }, []);

  const visibleTrades = result?.trades.filter((t) => {
    if (filterTrades === "WINS") return t.is_win;
    if (filterTrades === "LOSSES") return !t.is_win;
    return true;
  }) || [];

  return (
    <MainLayout>
      <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 lg:p-8 font-sans">
        
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧪</span>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Quantitative Strategy Backtester
              </h1>
              <span className="rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-0.5 text-xs font-bold text-violet-400">
                Indian Market Engine
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Simulate quantitative strategies over multi-year historical daily candles with risk management parameters.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={executeBacktest}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-900/30 transition-all flex items-center gap-2 cursor-pointer ${
              loading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <span>{loading ? "⚙️" : "▶"}</span>
            <span>{loading ? "Simulating Strategy..." : "Run Backtest"}</span>
          </button>
        </div>

        {/* Strategy Control Panel */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-xl">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
            Strategy &amp; Risk Parameters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Strategy Model */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Strategy Rule</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium focus:border-violet-500 focus:outline-none"
              >
                <option value="GOLDEN_CROSS">50/200 DMA Golden Cross</option>
                <option value="SWING_PULLBACK">50 EMA Pullback &amp; Bounce</option>
              </select>
            </div>

            {/* Universe */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Stock Universe</label>
              <select
                value={universe}
                onChange={(e) => setUniverse(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium focus:border-violet-500 focus:outline-none"
              >
                <option value="NIFTY 50">NIFTY 50 Index</option>
                <option value="NIFTY 100">NIFTY 100 Index</option>
                <option value="NIFTY 500">NIFTY 500 Index</option>
              </select>
            </div>

            {/* Single Stock Override */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Single Stock (Optional)</label>
              <input
                type="text"
                placeholder="e.g. RELIANCE, TCS"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white uppercase focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Lookback Years */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Lookback History</label>
              <select
                value={lookbackYears}
                onChange={(e) => setLookbackYears(parseInt(e.target.value))}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium focus:border-violet-500 focus:outline-none"
              >
                <option value={1}>1 Year (260 Days)</option>
                <option value={2}>2 Years (520 Days)</option>
                <option value={3}>3 Years (780 Days)</option>
              </select>
            </div>

            {/* Target % */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Take-Profit Target: {targetPct}%</label>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={targetPct}
                onChange={(e) => setTargetPct(parseFloat(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
            </div>

            {/* Stop Loss % */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Risk Stop-Loss: {stopLossPct}%</label>
              <input
                type="range"
                min={2}
                max={15}
                step={0.5}
                value={stopLossPct}
                onChange={(e) => setStopLossPct(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            {/* RSI Filter Max */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Max Entry RSI: {rsiFilterMax}</label>
              <input
                type="range"
                min={40}
                max={80}
                step={1}
                value={rsiFilterMax}
                onChange={(e) => setRsiFilterMax(parseFloat(e.target.value))}
                className="w-full accent-violet-500 cursor-pointer"
              />
            </div>

            {/* Capital */}
            <div>
              <label className="text-zinc-400 font-medium block mb-1">Starting Capital</label>
              <input
                type="number"
                step={10000}
                value={initialCapital}
                onChange={(e) => setInitialCapital(Math.max(10000, parseInt(e.target.value) || 100000))}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-mono focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Backtest KPI Performance Cards */}
        {result && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Strategy Return</div>
              <div className={`text-xl font-black mt-1 font-mono ${result.summary.total_return_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {result.summary.total_return_pct >= 0 ? "+" : ""}{result.summary.total_return_pct}%
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Bench: +{result.summary.benchmark_return_pct}%</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Win Rate</div>
              <div className="text-xl font-black text-violet-400 mt-1 font-mono">
                {result.summary.win_rate_pct}%
              </div>
              <div className="text-[10px] text-zinc-400 mt-1">
                {result.summary.winning_trades}W / {result.summary.losing_trades}L
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Profit Factor</div>
              <div className="text-xl font-black text-white mt-1 font-mono">
                {result.summary.profit_factor}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Gross Win / Loss</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Max Drawdown</div>
              <div className="text-xl font-black text-rose-400 mt-1 font-mono">
                -{result.summary.max_drawdown_pct}%
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Peak-to-trough risk</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Net Profit</div>
              <div className="text-xl font-black text-emerald-400 mt-1 font-mono">
                ₹{result.summary.net_profit.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Final: ₹{result.summary.final_capital.toLocaleString("en-IN")}</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Trades</div>
              <div className="text-xl font-black text-white mt-1 font-mono">
                {result.summary.total_trades}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">Avg Hold: {result.summary.avg_holding_days}d</div>
            </div>
          </div>
        )}

        {/* Equity Curve Visualizer */}
        {result && result.equity_curve.length > 0 && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Portfolio Equity Growth Curve
              </span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-violet-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500"></span> Strategy Equity
                </span>
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600"></span> Benchmark
                </span>
              </div>
            </div>

            {/* SVG Visual Line Chart */}
            <div className="h-44 w-full bg-zinc-950/60 rounded-xl border border-zinc-800/80 p-3 flex items-end">
              <div className="w-full h-full flex items-end gap-1">
                {result.equity_curve.map((pt, idx) => {
                  const minEq = result.summary.initial_capital * 0.9;
                  const maxEq = Math.max(...result.equity_curve.map((p) => p.equity), result.summary.initial_capital * 1.1);
                  const hPct = Math.max(10, Math.min(100, ((pt.equity - minEq) / (maxEq - minEq)) * 100));
                  return (
                    <div
                      key={idx}
                      title={`${pt.date}: ₹${pt.equity.toLocaleString("en-IN")} (DD: -${pt.drawdown_pct}%)`}
                      className="flex-1 rounded-t transition-all hover:bg-violet-400 cursor-pointer"
                      style={{
                        height: `${hPct}%`,
                        backgroundColor: pt.equity >= result.summary.initial_capital ? "#8b5cf6" : "#f43f5e",
                        opacity: 0.85,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500 mt-2 font-mono">
              <span>{result.equity_curve[0]?.date}</span>
              <span>{result.equity_curve[result.equity_curve.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {/* Trade Journal Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Simulated Trade Journal ({visibleTrades.length} trades)
            </span>

            {/* Filter Wins / Losses */}
            <div className="flex bg-zinc-950 rounded-xl p-1 border border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterTrades("ALL")}
                className={`px-3 py-1 rounded-lg transition ${filterTrades === "ALL" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterTrades("WINS")}
                className={`px-3 py-1 rounded-lg transition ${filterTrades === "WINS" ? "bg-emerald-600/30 text-emerald-400" : "text-zinc-500"}`}
              >
                Wins Only
              </button>
              <button
                type="button"
                onClick={() => setFilterTrades("LOSSES")}
                className={`px-3 py-1 rounded-lg transition ${filterTrades === "LOSSES" ? "bg-rose-600/30 text-rose-400" : "text-zinc-500"}`}
              >
                Losses Only
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Entry Date</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Exit Date</th>
                  <th className="py-2.5 px-3">Exit Price</th>
                  <th className="py-2.5 px-3">Hold Days</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">PnL %</th>
                  <th className="py-2.5 px-3 text-right">Profit / Loss (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {visibleTrades.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500 font-sans">
                      No trades matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-2.5 px-3 text-zinc-500">{t.id}</td>
                      <td className="py-2.5 px-3 font-bold font-sans text-white">{t.symbol}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{t.entry_date}</td>
                      <td className="py-2.5 px-3">₹{t.entry_price.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{t.exit_date}</td>
                      <td className="py-2.5 px-3">₹{t.exit_price.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-zinc-400">{t.holding_days}d</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.exit_reason === "TARGET"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : t.exit_reason === "STOP_LOSS"
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {t.exit_reason}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${t.pnl_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct}%
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${t.pnl_amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.pnl_amount >= 0 ? "+" : ""}₹{t.pnl_amount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
