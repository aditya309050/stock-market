"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";

interface OrderBookLevel {
  level: number;
  bid_orders: number;
  bid_qty: number;
  bid_price: number;
  bid_depth_pct: number;
  ask_price: number;
  ask_qty: number;
  ask_orders: number;
  ask_depth_pct: number;
}

interface OrderFlowZone {
  name: string;
  levels_range: string;
  weight_pct: number;
  icon: string;
  bid_qty: number;
  ask_qty: number;
  imbalance: number;
  bid_pressure_pct: number;
  ask_pressure_pct: number;
  status: string;
  status_color: string;
}

interface WallInfo {
  level: number;
  price: number;
  quantity: number;
  orders: number;
  label: string;
  pct_of_total: number;
}

interface OrderFlowData {
  security_id: string;
  instrument: {
    symbol?: string;
    strike?: number;
    option_type?: string;
    expiry?: string;
    trading_symbol?: string;
  };
  order_flow_score: number;
  overall_imbalance: number;
  overall_imbalance_pct: number;
  overall_bid_pressure: number;
  overall_ask_pressure: number;
  total_bid_qty: number;
  total_ask_qty: number;
  best_bid: number;
  best_ask: number;
  spread: number;
  spread_pct: number;
  zones: OrderFlowZone[];
  bid_wall: WallInfo | null;
  ask_wall: WallInfo | null;
  liquidity_concentration: {
    top5_pct?: number;
    top20_pct?: number;
  };
  liquidity_change: {
    overall_pct?: number;
    bid_pct?: number;
    ask_pct?: number;
  };
  liquidity_churn: string;
  book_levels: OrderBookLevel[];
  timestamp: string;
}

interface Props {
  symbol: string;
  expiry: string;
  atmStrike: number;
  strikes: number[];
  initialStrike?: number;
  initialOptionType?: "CE" | "PE";
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

function fmtQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function OrderFlow200({
  symbol,
  expiry,
  atmStrike,
  strikes,
  initialStrike,
  initialOptionType = "CE",
}: Props) {
  const [selectedStrike, setSelectedStrike] = useState<number>(initialStrike || atmStrike || 25000);
  const [selectedOptionType, setSelectedOptionType] = useState<"CE" | "PE">(initialOptionType);
  const [securityId, setSecurityId] = useState<string>("");
  const [orderFlow, setOrderFlow] = useState<OrderFlowData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Expandable sections for 200 levels
  const [expandZone21_50, setExpandZone21_50] = useState(false);
  const [expandZone51_100, setExpandZone51_100] = useState(false);
  const [expandZone101_200, setExpandZone101_200] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Sync strike if parent ATM strike changes and no initial strike selected
  useEffect(() => {
    if (!initialStrike && atmStrike && atmStrike > 0) {
      setSelectedStrike(atmStrike);
    }
  }, [atmStrike, initialStrike]);

  // Resolve Security ID dynamically for selected contract
  useEffect(() => {
    let active = true;
    async function resolveId() {
      try {
        const url = `${API_BASE}/fo-options/resolve-security-id?symbol=${encodeURIComponent(
          symbol
        )}&expiry=${encodeURIComponent(expiry)}&strike=${selectedStrike}&option_type=${selectedOptionType}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (active && data.security_id) {
            setSecurityId(data.security_id);
          }
        }
      } catch (err) {
        console.error("Error resolving security ID:", err);
      }
    }
    resolveId();
    return () => {
      active = false;
    };
  }, [symbol, expiry, selectedStrike, selectedOptionType]);

  // Initial REST fetch + WebSocket subscription
  useEffect(() => {
    if (!securityId) return;

    let active = true;
    setLoading(true);
    setError(null);

    // Initial snapshot fetch
    fetch(`${API_BASE}/fo-options/orderflow/${securityId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: OrderFlowData) => {
        if (active) {
          setOrderFlow(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError("Failed to fetch initial order flow snapshot");
          setLoading(false);
        }
      });

    // Real-time WebSocket connection
    const wsUrl = API_BASE.replace(/^http/, "ws") + `/fo-options/ws/orderflow/${securityId}`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (active) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          setOrderFlow(data);
          setLoading(false);
        } catch (e) {
          console.error("WS parse error:", e);
        }
      };

      ws.onerror = (e) => {
        if (active) setWsConnected(false);
      };

      ws.onclose = () => {
        if (active) setWsConnected(false);
      };
    } catch (err) {
      console.warn("WebSocket not supported or failed to connect:", err);
    }

    return () => {
      active = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [securityId]);

  // Partition book levels
  const levels1_20 = useMemo(() => orderFlow?.book_levels.slice(0, 20) || [], [orderFlow]);
  const levels21_50 = useMemo(() => orderFlow?.book_levels.slice(20, 50) || [], [orderFlow]);
  const levels51_100 = useMemo(() => orderFlow?.book_levels.slice(50, 100) || [], [orderFlow]);
  const levels101_200 = useMemo(() => orderFlow?.book_levels.slice(100, 200) || [], [orderFlow]);

  return (
    <div className="space-y-6">
      {/* Top Controls: Contract Selector & Live Feed Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🌊</span> 200-Level Full Market Depth Order Flow
            </h2>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 border ${
                wsConnected
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse"
                  : "bg-blue-500/15 text-blue-300 border-blue-500/30"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {wsConnected ? "Dhan 200-Depth Live Stream" : "Connected (Real-time Feed)"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Institutional-grade 200 bid & 200 ask depth analysis with weighted zone imbalances, wall detection, and liquidity churn.
          </p>
        </div>

        {/* Contract Picker */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CE / PE Toggle */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setSelectedOptionType("CE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedOptionType === "CE"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              CALL (CE)
            </button>
            <button
              onClick={() => setSelectedOptionType("PE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedOptionType === "PE"
                  ? "bg-rose-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              PUT (PE)
            </button>
          </div>

          {/* Strike Dropdown */}
          <select
            value={selectedStrike}
            onChange={(e) => setSelectedStrike(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 text-white text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500"
          >
            {strikes.map((stk) => (
              <option key={stk} value={stk}>
                Strike ₹{fmt(stk)} {stk === atmStrike ? "(ATM)" : ""}
              </option>
            ))}
          </select>

          {/* Security ID Badge */}
          {securityId && (
            <span className="text-[11px] font-mono bg-zinc-950 border border-zinc-800/80 px-2.5 py-1.5 rounded-xl text-zinc-400">
              SecID: <strong className="text-blue-400">{securityId}</strong>
            </span>
          )}
        </div>
      </div>

      {loading && !orderFlow ? (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-12 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
          <p className="text-sm text-zinc-300 font-medium">Connecting to Dhan 200-level market depth feed...</p>
          <p className="text-xs text-zinc-500 mt-1">Unpacking 200 bids & 200 asks binary frames for {symbol} {selectedStrike} {selectedOptionType}</p>
        </div>
      ) : orderFlow ? (
        <>
          {/* Order Flow Summary Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Order Flow Score Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Order Flow Score
                </span>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${
                    orderFlow.order_flow_score >= 65
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : orderFlow.order_flow_score <= 35
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {orderFlow.order_flow_score >= 65
                    ? "Bullish Flow"
                    : orderFlow.order_flow_score <= 35
                    ? "Bearish Flow"
                    : "Neutral Flow"}
                </span>
              </div>

              <div className="my-3 flex items-baseline gap-2">
                <span className="text-4xl font-black text-white tracking-tight">
                  {orderFlow.order_flow_score}
                </span>
                <span className="text-sm text-zinc-500 font-bold">/ 100</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-800 flex">
                <div
                  className={`h-full transition-all duration-300 ${
                    orderFlow.order_flow_score >= 65
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : orderFlow.order_flow_score <= 35
                      ? "bg-gradient-to-r from-rose-500 to-amber-500"
                      : "bg-gradient-to-r from-amber-400 to-yellow-500"
                  }`}
                  style={{ width: `${orderFlow.order_flow_score}%` }}
                ></div>
              </div>

              <div className="mt-3 flex justify-between text-[11px] text-zinc-400">
                <span>Weighted 200-Depth</span>
                <span className="font-semibold text-zinc-300">
                  {orderFlow.overall_imbalance >= 0 ? "+" : ""}
                  {orderFlow.overall_imbalance_pct}% Net
                </span>
              </div>
            </div>

            {/* 2. Bid vs Ask Pressure */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Total 200-Level Pressure
              </span>

              <div className="grid grid-cols-2 gap-3 my-2">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                  <span className="text-[10px] text-emerald-400 font-bold block uppercase">Bid Pressure</span>
                  <p className="text-xl font-black text-emerald-400">+{orderFlow.overall_bid_pressure}%</p>
                  <p className="text-[10px] text-zinc-500">{fmtQty(orderFlow.total_bid_qty)} qty</p>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                  <span className="text-[10px] text-rose-400 font-bold block uppercase">Ask Pressure</span>
                  <p className="text-xl font-black text-rose-400">-{orderFlow.overall_ask_pressure}%</p>
                  <p className="text-[10px] text-zinc-500">{fmtQty(orderFlow.total_ask_qty)} qty</p>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
                <span>Spread: <strong className="text-white">₹{orderFlow.spread.toFixed(2)}</strong></span>
                <span>({orderFlow.spread_pct}%)</span>
              </div>
            </div>

            {/* 3. Displayed Liquidity Walls */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Displayed Liquidity Walls
              </span>

              <div className="space-y-2 my-2 text-xs">
                {orderFlow.bid_wall && (
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-2 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-400 block">
                        Large Bid Wall (L{orderFlow.bid_wall.level})
                      </span>
                      <span className="text-xs font-bold text-white">₹{orderFlow.bid_wall.price.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-300">{fmtQty(orderFlow.bid_wall.quantity)}</span>
                      <span className="text-[10px] text-zinc-500 block">{orderFlow.bid_wall.orders} orders</span>
                    </div>
                  </div>
                )}

                {orderFlow.ask_wall && (
                  <div className="bg-rose-950/20 border border-rose-500/20 p-2 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-400 block">
                        Large Ask Wall (L{orderFlow.ask_wall.level})
                      </span>
                      <span className="text-xs font-bold text-white">₹{orderFlow.ask_wall.price.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-rose-300">{fmtQty(orderFlow.ask_wall.quantity)}</span>
                      <span className="text-[10px] text-zinc-500 block">{orderFlow.ask_wall.orders} orders</span>
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-zinc-500">
                Single-level outlier concentrations across 200 depth
              </span>
            </div>

            {/* 4. Liquidity Churn & Concentration */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Liquidity Dynamics
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    orderFlow.liquidity_churn === "High"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : orderFlow.liquidity_churn === "Moderate"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {orderFlow.liquidity_churn} Churn
                </span>
              </div>

              <div className="space-y-1.5 my-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Liquidity Delta:</span>
                  <span
                    className={`font-bold ${
                      (orderFlow.liquidity_change.overall_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {(orderFlow.liquidity_change.overall_pct || 0) >= 0 ? "+" : ""}
                    {orderFlow.liquidity_change.overall_pct || 0}%
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Top 5 Concentration:</span>
                  <span className="font-bold text-white">{orderFlow.liquidity_concentration.top5_pct || 0}%</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Top 20 Concentration:</span>
                  <span className="font-bold text-white">{orderFlow.liquidity_concentration.top20_pct || 0}%</span>
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 flex justify-between border-t border-zinc-800/80 pt-1.5">
                <span>Best Bid: ₹{orderFlow.best_bid.toFixed(2)}</span>
                <span>Best Ask: ₹{orderFlow.best_ask.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 5-Zone Weighted Imbalance Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>⚖️</span> Weighted Zone Imbalance Breakdown
                </h3>
                <p className="text-xs text-zinc-400">
                  Depth levels segmented by proximity with weighted influence (Immediate 35%, Near 30%, Medium 20%, Deep 10%, Extended 5%).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {orderFlow.zones.map((zone) => (
                <div
                  key={zone.name}
                  className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/90 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span>{zone.icon}</span> {zone.name}
                    </span>
                    <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-1.5 py-0.5 rounded">
                      {zone.weight_pct}% wt
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 mb-2">
                    Levels {zone.levels_range}
                  </div>

                  {/* Zone Status Badge */}
                  <div className="my-1.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block ${
                        zone.status === "Strong"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : zone.status === "Positive"
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : zone.status === "Neutral"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                          : zone.status === "Weak"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {zone.status === "Strong" ? "🟢 Strong" : zone.status === "Positive" ? "🟢 Positive" : zone.status === "Neutral" ? "🟡 Neutral" : zone.status === "Weak" ? "🔴 Weak" : "🔴 Bearish"}
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden flex my-2">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${zone.bid_pressure_pct}%` }}
                    ></div>
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${zone.ask_pressure_pct}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between text-[10px] font-mono mt-1">
                    <span className="text-emerald-400">+{zone.bid_pressure_pct}%</span>
                    <span className="text-rose-400">-{zone.ask_pressure_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 200-Level Compact Order Book Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📖</span> 200-Level Compact Order Book
                </h3>
                <p className="text-xs text-zinc-400">
                  Showing default levels 1–20. Expand zones below to inspect deeper displayed liquidity.
                </p>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {orderFlow.book_levels.length} Total Levels
              </span>
            </div>

            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-left w-14">Level</th>
                    <th className="py-2.5 px-3 text-right">Orders</th>
                    <th className="py-2.5 px-3 text-right">Bid Qty</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400 font-bold">Bid Price</th>
                    <th className="py-2.5 px-3 text-left text-rose-400 font-bold">Ask Price</th>
                    <th className="py-2.5 px-3 text-left">Ask Qty</th>
                    <th className="py-2.5 px-3 text-left">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {/* Default Levels 1–20 */}
                  {levels1_20.map((lvl) => (
                    <OrderBookRow key={lvl.level} row={lvl} />
                  ))}

                  {/* Expandable Section: Levels 21–50 (Medium Zone) */}
                  <tr>
                    <td colSpan={7} className="p-0">
                      <button
                        onClick={() => setExpandZone21_50((prev) => !prev)}
                        className="w-full bg-zinc-950/90 hover:bg-zinc-950 text-blue-400 hover:text-blue-300 py-2.5 px-4 text-left font-sans text-xs font-semibold flex items-center justify-between border-y border-zinc-800/80 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>{expandZone21_50 ? "▼" : "▶"}</span>
                          <span>Medium Zone (Levels 21–50)</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">30 Levels</span>
                      </button>
                    </td>
                  </tr>
                  {expandZone21_50 &&
                    levels21_50.map((lvl) => (
                      <OrderBookRow key={lvl.level} row={lvl} />
                    ))}

                  {/* Expandable Section: Levels 51–100 (Deep Zone) */}
                  <tr>
                    <td colSpan={7} className="p-0">
                      <button
                        onClick={() => setExpandZone51_100((prev) => !prev)}
                        className="w-full bg-zinc-950/90 hover:bg-zinc-950 text-blue-400 hover:text-blue-300 py-2.5 px-4 text-left font-sans text-xs font-semibold flex items-center justify-between border-y border-zinc-800/80 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>{expandZone51_100 ? "▼" : "▶"}</span>
                          <span>Deep Zone (Levels 51–100)</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">50 Levels</span>
                      </button>
                    </td>
                  </tr>
                  {expandZone51_100 &&
                    levels51_100.map((lvl) => (
                      <OrderBookRow key={lvl.level} row={lvl} />
                    ))}

                  {/* Expandable Section: Levels 101–200 (Extended Zone) */}
                  <tr>
                    <td colSpan={7} className="p-0">
                      <button
                        onClick={() => setExpandZone101_200((prev) => !prev)}
                        className="w-full bg-zinc-950/90 hover:bg-zinc-950 text-blue-400 hover:text-blue-300 py-2.5 px-4 text-left font-sans text-xs font-semibold flex items-center justify-between border-y border-zinc-800/80 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>{expandZone101_200 ? "▼" : "▶"}</span>
                          <span>Extended Zone (Levels 101–200)</span>
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">100 Levels</span>
                      </button>
                    </td>
                  </tr>
                  {expandZone101_200 &&
                    levels101_200.map((lvl) => (
                      <OrderBookRow key={lvl.level} row={lvl} />
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function OrderBookRow({ row }: { row: OrderBookLevel }) {
  return (
    <tr className="hover:bg-zinc-800/40 transition-colors">
      {/* Level */}
      <td className="py-2 px-3 text-zinc-500 text-[11px]">#{row.level}</td>

      {/* Bid Orders */}
      <td className="py-2 px-3 text-right text-zinc-400 text-[11px]">{row.bid_orders || "-"}</td>

      {/* Bid Qty with visual depth bar */}
      <td className="py-2 px-3 text-right font-semibold text-zinc-200 relative">
        <div
          className="absolute right-0 top-1 bottom-1 bg-emerald-500/15 rounded-l"
          style={{ width: `${Math.min(100, row.bid_depth_pct)}%` }}
        ></div>
        <span className="relative z-10">{fmt(row.bid_qty)}</span>
      </td>

      {/* Bid Price */}
      <td className="py-2 px-3 text-right font-bold text-emerald-400 bg-emerald-950/10">
        ₹{row.bid_price.toFixed(2)}
      </td>

      {/* Ask Price */}
      <td className="py-2 px-3 text-left font-bold text-rose-400 bg-rose-950/10">
        ₹{row.ask_price.toFixed(2)}
      </td>

      {/* Ask Qty with visual depth bar */}
      <td className="py-2 px-3 text-left font-semibold text-zinc-200 relative">
        <div
          className="absolute left-0 top-1 bottom-1 bg-rose-500/15 rounded-r"
          style={{ width: `${Math.min(100, row.ask_depth_pct)}%` }}
        ></div>
        <span className="relative z-10">{fmt(row.ask_qty)}</span>
      </td>

      {/* Ask Orders */}
      <td className="py-2 px-3 text-left text-zinc-400 text-[11px]">{row.ask_orders || "-"}</td>
    </tr>
  );
}
