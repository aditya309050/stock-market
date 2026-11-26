"use client";

import React, { useState } from "react";
import { placeDhanOrder, type DhanOrderRequest, type DhanOrderResponse } from "@/lib/api";

interface DhanOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol: string;
  defaultPrice?: number;
  defaultStopLoss?: number;
  defaultTarget?: number;
  defaultSide?: "BUY" | "SELL";
  exchangeSegment?: string;
}

export function DhanOrderModal({
  isOpen,
  onClose,
  defaultSymbol,
  defaultPrice = 0,
  defaultStopLoss,
  defaultTarget,
  defaultSide = "BUY",
  exchangeSegment = "NSE_EQ",
}: DhanOrderModalProps) {
  const [side, setSide] = useState<"BUY" | "SELL">(defaultSide);
  const [productType, setProductType] = useState<"INTRADAY" | "CNC" | "MARGIN">("INTRADAY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState<number>(25);
  const [price, setPrice] = useState<number>(defaultPrice);
  const [stopLoss, setStopLoss] = useState<string>(defaultStopLoss ? defaultStopLoss.toString() : "");
  const [target, setTarget] = useState<string>(defaultTarget ? defaultTarget.toString() : "");
  const [isPaper, setIsPaper] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DhanOrderResponse | null>(null);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const estMargin = (price > 0 ? price : defaultPrice) * quantity;

  const handlePlaceOrder = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    const payload: DhanOrderRequest = {
      symbol: defaultSymbol,
      exchange_segment: exchangeSegment,
      transaction_type: side,
      product_type: productType,
      order_type: orderType,
      quantity,
      price: orderType === "LIMIT" ? price : 0,
      stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
      target: target ? parseFloat(target) : undefined,
      is_paper_trading: isPaper,
    };

    try {
      const res = await placeDhanOrder(payload);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to place order. Check network and broker status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-white font-sans animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">{defaultSymbol}</span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                {exchangeSegment}
              </span>
              {isPaper ? (
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                  Paper Mode
                </span>
              ) : (
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                  Live Dhan Execution
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Ref Price: <span className="font-semibold text-zinc-200">₹{defaultPrice ? defaultPrice.toFixed(2) : "0.00"}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Success Banner */}
        {result && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <span>✓</span> Order Executed: {result.order_status}
            </div>
            <p className="text-xs text-zinc-300 mt-1">{result.message}</p>
            <div className="text-[11px] text-zinc-500 mt-2 font-mono">
              Order ID: {result.order_id} | Time: {new Date(result.executed_at).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            ⚠ {error}
          </div>
        )}

        {/* Buy / Sell Selector */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => setSide("BUY")}
            className={`py-2 text-sm font-bold rounded-lg transition-all ${
              side === "BUY"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            BUY
          </button>
          <button
            type="button"
            onClick={() => setSide("SELL")}
            className={`py-2 text-sm font-bold rounded-lg transition-all ${
              side === "SELL"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            SELL
          </button>
        </div>

        {/* Product Type & Order Type */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Product Type</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as any)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
            >
              <option value="INTRADAY">INTRADAY (MIS)</option>
              <option value="CNC">CNC (Delivery)</option>
              <option value="MARGIN">MARGIN</option>
            </select>
          </div>

          <div>
            <label className="text-zinc-400 font-medium block mb-1">Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-medium focus:border-purple-500 focus:outline-none"
            >
              <option value="MARKET">MARKET</option>
              <option value="LIMIT">LIMIT</option>
            </select>
          </div>
        </div>

        {/* Quantity & Price */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-semibold focus:border-purple-500 focus:outline-none"
            />
            <div className="mt-1 flex gap-1">
              {[25, 50, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-zinc-400 font-medium block mb-1">Limit Price (₹)</label>
            <input
              type="number"
              step={0.05}
              disabled={orderType === "MARKET"}
              value={price || defaultPrice}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className={`w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white font-semibold focus:border-purple-500 focus:outline-none ${
                orderType === "MARKET" ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        {/* Bracket Protection: SL & Target */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs border-t border-zinc-800/80 pt-3">
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Stop Loss (Optional)</label>
            <input
              type="number"
              step={0.05}
              placeholder="e.g. 24800"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-zinc-400 font-medium block mb-1">Target (Optional)</label>
            <input
              type="number"
              step={0.05}
              placeholder="e.g. 25200"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Paper vs Live Toggle & Est Margin */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-900/60 p-3 border border-zinc-800 text-xs">
          <div>
            <span className="text-zinc-400">Est. Order Value: </span>
            <span className="font-bold text-white font-mono">₹{estMargin.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPaper}
              onChange={(e) => setIsPaper(e.target.checked)}
              className="accent-purple-500 h-4 w-4 rounded"
            />
            <span className="text-xs text-zinc-300 font-medium">Paper Mode</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handlePlaceOrder}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all shadow-lg ${
              side === "BUY"
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
                : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/25"
            } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {loading ? "Transmitting..." : `Instant ${side} via ${isPaper ? "Paper" : "Dhan"}`}
          </button>
        </div>

      </div>
    </div>
  );
}
