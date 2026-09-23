"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { SummaryCards } from "@/components/options/SummaryCards";
import { MarketIntelligence } from "@/components/options/MarketIntelligence";
import { ExpectedMoveVisualizer } from "@/components/options/ExpectedMoveVisualizer";
import { LiquidityMap } from "@/components/options/LiquidityMap";
import { OIHeatmap } from "@/components/options/OIHeatmap";
import { OptionDetailsDrawer, DrawerOptionData } from "@/components/options/OptionDetailsDrawer";
import { BacktestModal } from "@/components/options/BacktestModal";
import { EvidenceModal, EvidenceItem } from "@/components/options/EvidenceModal";
import { OrderFlow200 } from "@/components/options/OrderFlow200";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Tab Config ─────────────────────────────────────────────────────────────
type TabId = "overview" | "chain" | "orderflow" | "liquidity" | "heatmap" | "candidates" | "aireview";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "📊 Overview" },
  { id: "chain", label: "📋 Option Chain" },
  { id: "orderflow", label: "🌊 200-Level Order Flow" },
  { id: "liquidity", label: "🗺️ Liquidity Map" },
  { id: "heatmap", label: "🔥 OI Heatmap" },
  { id: "candidates", label: "⭐ Candidates" },
  { id: "aireview", label: "✨ AI Review" },
];

type Bias = "BULLISH" | "BEARISH" | "NEUTRAL";
const BIAS_OPTIONS: Bias[] = ["BULLISH", "NEUTRAL", "BEARISH"];
const SYMBOLS = ["NIFTY", "BANKNIFTY", "MIDCPNIFTY", "FINNIFTY"];

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface ChainRow {
  strike: number;
  ce_oi: number; ce_doi: number; ce_ltp: number; ce_iv: number; ce_volume: number;
  ce_delta: number; ce_gamma: number; ce_theta: number; ce_vega: number;
  pe_oi: number; pe_doi: number; pe_ltp: number; pe_iv: number; pe_volume: number;
  pe_delta: number; pe_gamma: number; pe_theta: number; pe_vega: number;
  liquidity_score?: number;
  liquidity_tag?: string;
  ce_bid?: number;
  ce_ask?: number;
  pe_bid?: number;
  pe_ask?: number;
}

interface ChainData {
  symbol: string; spot: number; expiry: string; expiry_dates: string[];
  atm_strike: number; pcr: number; iv_avg: number; market_bias: string;
  total_ce_oi: number; total_pe_oi: number;
  max_pain: number;
  call_wall: number;
  put_wall: number;
  expected_move: number;
  expected_move_range: number[];
  market_regime: string;
  positioning: string;
  positioning_details?: { price_pct?: string; oi_pct?: string; volume_delta?: string };
  volatility_regime: string;
  rows: ChainRow[];
  timestamp: string;
  is_synthetic: boolean;
}

interface Check { label: string; pass: boolean; }
interface Candidate {
  strike: number; option_type: "CE" | "PE"; ltp: number;
  delta: number; gamma: number; theta: number; vega: number;
  iv: number; oi: number; oi_change: number; volume: number; score: number;
  score_breakdown: { delta: number; oi: number; oi_change: number; iv: number; liquidity: number };
  checks: Check[];
  targets: { T1: number; T2: number };
  invalidation: string; explanation: string; evidence_score: string; ai_review: string;
  ai_status?: string;
  ai_conflicts?: string[];
  reasons?: string[];
  risk_reward?: string;
  potential_reaction_zones?: { upside_levels?: number[]; downside_levels?: number[]; invalidation_level?: number };
  liquidity_score?: number;
}

interface CandidatesData {
  symbol: string; spot: number; expiry: string; atm_strike: number;
  pcr: number; iv_avg: number; market_bias: string; bias_requested: string;
  candidates: Candidate[]; timestamp: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number, d = 0): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}
function fmtOI(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function biasColor(b: string): string {
  if (b.includes("BULL")) return "text-emerald-400";
  if (b.includes("BEAR")) return "text-red-400";
  return "text-yellow-400";
}
function biasEmoji(b: Bias): string {
  return b === "BULLISH" ? "⬆" : b === "BEARISH" ? "⬇" : "➡";
}

function OIBar({ value, max, side }: { value: number; max: number; side: "ce" | "pe" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const base = side === "ce" ? "bg-blue-500" : "bg-orange-500";
  const flip = side === "ce" ? { transform: "rotate(180deg)" } : {};
  return (
    <div className="h-2 rounded-sm bg-zinc-800 overflow-hidden" style={flip}>
      <div className={`h-full rounded-sm ${base}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────────────
export default function FoOptionsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState("");
  const [bias, setBias] = useState<Bias>("BULLISH");
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Filter & Range State
  const [strikeRange, setStrikeRange] = useState<"atm_5" | "atm_10" | "atm_15" | "all">("atm_10");
  const [strikeInterval, setStrikeInterval] = useState<"all" | "50" | "100">("all");
  const [filterChip, setFilterChip] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("strike_asc");

  // Columns visibility toggles
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [cols, setCols] = useState({
    volume: false,
    delta: false,
    gamma: false,
    theta: false,
    vega: false,
    bidAsk: false,
  });

  // Modal / Drawer states
  const [drawerData, setDrawerData] = useState<DrawerOptionData | null>(null);
  const [backtestOption, setBacktestOption] = useState<DrawerOptionData | null>(null);
  const [evidenceItem, setEvidenceItem] = useState<EvidenceItem | null>(null);

  // 200-Level Order Flow Selected Contract
  const [orderFlowStrike, setOrderFlowStrike] = useState<number>(0);
  const [orderFlowOptionType, setOrderFlowOptionType] = useState<"CE" | "PE">("CE");

  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [candidatesData, setCandidatesData] = useState<CandidatesData | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Chain
  const fetchChain = useCallback(async (sym: string, exp: string) => {
    setLoadingChain(true);
    setError(null);
    try {
      const url = `${API_BASE}/fo-options/chain?symbol=${sym}${exp ? `&expiry=${encodeURIComponent(exp)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail || `HTTP ${res.status}`);
      }
      const data: ChainData = await res.json();
      setChainData(data);
      if (!exp && data.expiry) setExpiry(data.expiry);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch chain");
    } finally {
      setLoadingChain(false);
    }
  }, []);

  // Fetch Candidates
  const fetchCandidates = useCallback(async (sym: string, exp: string, b: Bias) => {
    setLoadingCandidates(true);
    try {
      const url = `${API_BASE}/fo-options/candidates?symbol=${sym}&bias=${b}${exp ? `&expiry=${encodeURIComponent(exp)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data: CandidatesData = await res.json();
      setCandidatesData(data);
    } catch {
      // silent
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    setExpiry("");
    setChainData(null);
    setCandidatesData(null);
    fetchChain(symbol, "");
  }, [symbol, fetchChain]);

  useEffect(() => {
    if (chainData && chainData.expiry) {
      fetchCandidates(symbol, chainData.expiry, bias);
    }
  }, [chainData, bias, symbol, fetchCandidates]);

  const handleRefresh = () => {
    fetchChain(symbol, expiry);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setExpiry(v);
    fetchChain(symbol, v);
  };

  // Filtered & Sorted Rows for Option Chain Table
  const displayRows = useMemo<ChainRow[]>(() => {
    if (!chainData) return [];
    let rows = [...chainData.rows];
    const atm = chainData.atm_strike;

    // 1. Strike range filter
    if (strikeRange === "atm_5") {
      rows = rows.filter((r) => Math.abs(r.strike - atm) <= 5 * 50);
    } else if (strikeRange === "atm_10") {
      rows = rows.filter((r) => Math.abs(r.strike - atm) <= 10 * 50);
    } else if (strikeRange === "atm_15") {
      rows = rows.filter((r) => Math.abs(r.strike - atm) <= 15 * 50);
    }

    // 2. Strike interval filter
    if (strikeInterval === "50") {
      rows = rows.filter((r) => r.strike % 50 === 0);
    } else if (strikeInterval === "100") {
      rows = rows.filter((r) => r.strike % 100 === 0);
    }

    // 3. Filter chips
    if (filterChip === "high_oi") {
      const avgOI = (chainData.total_ce_oi + chainData.total_pe_oi) / (chainData.rows.length * 2);
      rows = rows.filter((r) => r.ce_oi > avgOI || r.pe_oi > avgOI);
    } else if (filterChip === "high_doi") {
      rows = rows.filter((r) => r.ce_doi > 5000 || r.pe_doi > 5000);
    } else if (filterChip === "high_vol") {
      rows = rows.filter((r) => (r.ce_volume + r.pe_volume) > 15000);
    } else if (filterChip === "high_iv") {
      rows = rows.filter((r) => r.ce_iv > chainData.iv_avg * 1.05 || r.pe_iv > chainData.iv_avg * 1.05);
    } else if (filterChip === "low_iv") {
      rows = rows.filter((r) => r.ce_iv < chainData.iv_avg * 0.95 || r.pe_iv < chainData.iv_avg * 0.95);
    } else if (filterChip === "itm") {
      rows = rows.filter((r) => r.strike < chainData.spot);
    } else if (filterChip === "otm") {
      rows = rows.filter((r) => r.strike > chainData.spot);
    } else if (filterChip === "atm") {
      rows = rows.filter((r) => Math.abs(r.strike - atm) <= 100);
    }

    // 4. Sort By
    if (sortBy === "strike_asc") rows.sort((a, b) => a.strike - b.strike);
    else if (sortBy === "strike_desc") rows.sort((a, b) => b.strike - a.strike);
    else if (sortBy === "oi_desc") rows.sort((a, b) => (b.ce_oi + b.pe_oi) - (a.ce_oi + a.pe_oi));
    else if (sortBy === "doi_desc") rows.sort((a, b) => (Math.abs(b.ce_doi) + Math.abs(b.pe_doi)) - (Math.abs(a.ce_doi) + Math.abs(a.pe_doi)));
    else if (sortBy === "vol_desc") rows.sort((a, b) => (b.ce_volume + b.pe_volume) - (a.ce_volume + a.pe_volume));
    else if (sortBy === "score_desc") rows.sort((a, b) => (b.liquidity_score || 0) - (a.liquidity_score || 0));

    return rows;
  }, [chainData, strikeRange, strikeInterval, filterChip, sortBy]);

  const maxCeOI = useMemo(() => Math.max(...displayRows.map((r) => r.ce_oi), 1), [displayRows]);
  const maxPeOI = useMemo(() => Math.max(...displayRows.map((r) => r.pe_oi), 1), [displayRows]);

  // Open drawer for a strike row
  const openRowDrawer = (row: ChainRow, side: "CE" | "PE") => {
    if (!chainData) return;
    const isCE = side === "CE";
    setDrawerData({
      strike: row.strike,
      option_type: side,
      ltp: isCE ? row.ce_ltp : row.pe_ltp,
      delta: isCE ? row.ce_delta : row.pe_delta,
      gamma: isCE ? row.ce_gamma : row.pe_gamma,
      theta: isCE ? row.ce_theta : row.pe_theta,
      vega: isCE ? row.ce_vega : row.pe_vega,
      iv: isCE ? row.ce_iv : row.pe_iv,
      oi: isCE ? row.ce_oi : row.pe_oi,
      oi_change: isCE ? row.ce_doi : row.pe_doi,
      volume: isCE ? row.ce_volume : row.pe_volume,
      bid: isCE ? row.ce_bid : row.pe_bid,
      ask: isCE ? row.ce_ask : row.pe_ask,
      liquidity_score: row.liquidity_score || 75,
      symbol: chainData.symbol,
      spot: chainData.spot,
      expiry: chainData.expiry,
    });
  };

  // Open drawer for a candidate
  const openCandidateDrawer = (c: Candidate) => {
    if (!chainData) return;
    setDrawerData({
      strike: c.strike,
      option_type: c.option_type,
      ltp: c.ltp,
      delta: c.delta,
      gamma: c.gamma,
      theta: c.theta,
      vega: c.vega,
      iv: c.iv,
      oi: c.oi,
      oi_change: c.oi_change,
      volume: c.volume,
      score: c.score,
      targets: c.targets,
      invalidation: c.invalidation,
      explanation: c.explanation,
      reasons: c.reasons,
      ai_review: c.ai_review,
      ai_status: c.ai_status,
      ai_conflicts: c.ai_conflicts,
      risk_reward: c.risk_reward,
      liquidity_score: c.liquidity_score,
      symbol: chainData.symbol,
      spot: chainData.spot,
      expiry: chainData.expiry,
    });
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-[105rem] mx-auto space-y-5">
        {/* ── 1. Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-violet-500/20">
              📊
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Options Intelligence Dashboard
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">
                  TERMINAL
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-0.5">
                Institutional option chain · Greeks · Liquidity mapping · Candidate engine · AI validation
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Symbol */}
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 text-white rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Expiry */}
            <select
              value={expiry}
              onChange={handleExpiryChange}
              className="bg-zinc-950 border border-zinc-700 text-white rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-violet-500 cursor-pointer min-w-[135px]"
            >
              {(chainData?.expiry_dates ?? []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Bias Toggle */}
            <div className="flex bg-zinc-950 border border-zinc-700 rounded-xl overflow-hidden text-xs font-bold">
              {BIAS_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBias(b)}
                  className={`px-3 py-2 transition-all cursor-pointer ${
                    bias === b
                      ? b === "BULLISH"
                        ? "bg-emerald-500 text-zinc-950"
                        : b === "BEARISH"
                        ? "bg-red-500 text-white"
                        : "bg-amber-500 text-zinc-950"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {biasEmoji(b)} {b.charAt(0) + b.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loadingChain}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-violet-600/20"
            >
              {loadingChain ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Synthetic Notice */}
        {chainData?.is_synthetic && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <span>
                <strong>Derived Synthetic Model:</strong> Live exchange feed off-session. Option chain and Greeks computed via Black-Scholes using real NIFTY spot price.
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 rounded font-mono font-bold">SIMULATED BS</span>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* Loading */}
        {loadingChain && !chainData && (
          <div className="p-20 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-300 text-sm font-semibold">Synchronizing F&amp;O analytics and Greeks...</p>
            <p className="text-zinc-500 text-xs">Computing Max Pain, Expected Move, and Liquidity Scores</p>
          </div>
        )}

        {chainData && (
          <>
            {/* ── 2. Top Summary Section (9 Cards) ────────────────────────────── */}
            <SummaryCards
              spot={chainData.spot}
              symbol={chainData.symbol}
              atmStrike={chainData.atm_strike}
              pcr={chainData.pcr}
              ivAvg={chainData.iv_avg}
              expectedMove={chainData.expected_move || 145}
              expectedMoveRange={chainData.expected_move_range || [chainData.spot - 145, chainData.spot + 145]}
              maxPain={chainData.max_pain || chainData.atm_strike}
              callWall={chainData.call_wall || chainData.atm_strike + 100}
              putWall={chainData.put_wall || chainData.atm_strike - 100}
              marketBias={chainData.market_bias}
              expiry={chainData.expiry}
            />

            {/* ── 3. Market Intelligence Section ─────────────────────────────── */}
            <MarketIntelligence
              marketRegime={chainData.market_regime || chainData.market_bias}
              positioning={chainData.positioning || "Long Buildup"}
              positioningDetails={chainData.positioning_details}
              volatilityRegime={chainData.volatility_regime || "Moderate"}
              ivAvg={chainData.iv_avg}
              expectedMove={chainData.expected_move || 145}
              expectedMoveRange={chainData.expected_move_range || [chainData.spot - 145, chainData.spot + 145]}
              putWall={chainData.put_wall || chainData.atm_strike - 100}
              atmStrike={chainData.atm_strike}
              callWall={chainData.call_wall || chainData.atm_strike + 100}
              maxPain={chainData.max_pain || chainData.atm_strike}
            />

            {/* ── 4. Navigation Tabs ─────────────────────────────────────────── */}
            <div className="flex gap-1.5 bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl w-fit text-xs font-bold overflow-x-auto">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-4 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === id
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── TAB: OVERVIEW ──────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Expected Move Visualizer */}
                <ExpectedMoveVisualizer
                  spot={chainData.spot}
                  atmStrike={chainData.atm_strike}
                  expectedMove={chainData.expected_move || 145}
                  expectedMoveRange={chainData.expected_move_range || [chainData.spot - 145, chainData.spot + 145]}
                  callWall={chainData.call_wall || chainData.atm_strike + 100}
                  putWall={chainData.put_wall || chainData.atm_strike - 100}
                  maxPain={chainData.max_pain || chainData.atm_strike}
                />

                {/* Liquidity Map in Overview */}
                <LiquidityMap
                  rows={chainData.rows}
                  atmStrike={chainData.atm_strike}
                  spot={chainData.spot}
                  callWall={chainData.call_wall}
                  putWall={chainData.put_wall}
                  maxPain={chainData.max_pain}
                  onSelectStrike={(k) => {
                    const r = chainData.rows.find((x) => x.strike === k);
                    if (r) openRowDrawer(r, k >= chainData.atm_strike ? "CE" : "PE");
                  }}
                />
              </div>
            )}

            {/* ── TAB: OPTION CHAIN ──────────────────────────────────────────── */}
            {activeTab === "chain" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl space-y-3">
                {/* Controls Bar */}
                <div className="p-4 border-b border-zinc-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  {/* Left: Strike Range & Interval */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-xl text-xs font-bold">
                      <span className="text-[10px] text-zinc-500 uppercase px-2">Range:</span>
                      {[
                        { id: "atm_5", label: "ATM ±5" },
                        { id: "atm_10", label: "ATM ±10" },
                        { id: "atm_15", label: "ATM ±15" },
                        { id: "all", label: "ALL" },
                      ].map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setStrikeRange(r.id as typeof strikeRange)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            strikeRange === r.id ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-xl text-xs font-bold">
                      <span className="text-[10px] text-zinc-500 uppercase px-2">Step:</span>
                      {[
                        { id: "all", label: "All" },
                        { id: "50", label: "50" },
                        { id: "100", label: "100" },
                      ].map((stp) => (
                        <button
                          key={stp.id}
                          onClick={() => setStrikeInterval(stp.id as typeof strikeInterval)}
                          className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            strikeInterval === stp.id ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          {stp.label}
                        </button>
                      ))}
                    </div>

                    {/* Columns Selector Button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowColumnsModal(!showColumnsModal)}
                        className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <span>⚙️</span> Columns
                      </button>

                      {showColumnsModal && (
                        <div className="absolute top-full left-0 mt-2 w-52 bg-zinc-950 border border-zinc-700 rounded-xl p-3 shadow-2xl z-40 space-y-2 text-xs animate-in fade-in">
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 border-b border-zinc-800 pb-1">
                            Toggle Columns
                          </div>
                          {[
                            { key: "volume", label: "Volume" },
                            { key: "delta", label: "Delta (Δ)" },
                            { key: "gamma", label: "Gamma (Γ)" },
                            { key: "theta", label: "Theta (Θ)" },
                            { key: "vega", label: "Vega (ν)" },
                            { key: "bidAsk", label: "Bid / Ask / Spread" },
                          ].map((col) => (
                            <label key={col.key} className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                              <input
                                type="checkbox"
                                checked={cols[col.key as keyof typeof cols]}
                                onChange={(e) => setCols({ ...cols, [col.key]: e.target.checked })}
                                className="rounded border-zinc-700 text-violet-600 focus:ring-violet-500"
                              />
                              <span>{col.label}</span>
                            </label>
                          ))}
                          <button
                            onClick={() => setShowColumnsModal(false)}
                            className="w-full mt-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold rounded"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Sort & Legend */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span>Sort:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-white font-mono text-xs focus:outline-none"
                      >
                        <option value="strike_asc">Strike Ascending</option>
                        <option value="strike_desc">Strike Descending</option>
                        <option value="oi_desc">Highest OI</option>
                        <option value="doi_desc">Highest ΔOI Change</option>
                        <option value="vol_desc">Highest Volume</option>
                        <option value="score_desc">Highest Liquidity Score</option>
                      </select>
                    </div>

                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-zinc-400 pl-2 border-l border-zinc-800">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />CE Call</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />PE Put</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block" />ATM</span>
                    </div>
                  </div>
                </div>

                {/* Filter Chips Bar */}
                <div className="px-4 pb-2 flex items-center gap-1.5 overflow-x-auto text-[11px] font-semibold text-zinc-400">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Quick Filters:</span>
                  {[
                    { id: "all", label: "All Strikes" },
                    { id: "high_oi", label: "High OI" },
                    { id: "high_doi", label: "High ΔOI" },
                    { id: "high_vol", label: "High Volume" },
                    { id: "high_iv", label: "High IV" },
                    { id: "low_iv", label: "Low IV" },
                    { id: "itm", label: "ITM" },
                    { id: "atm", label: "ATM" },
                    { id: "otm", label: "OTM" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setFilterChip(chip.id)}
                      className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
                        filterChip === chip.id
                          ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                          : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800 font-semibold text-[11px]">
                        {cols.bidAsk && <th className="text-right py-2.5 px-2 text-blue-400/70">Bid/Ask</th>}
                        {cols.vega && <th className="text-right py-2.5 px-2 text-blue-400/70">Vega</th>}
                        {cols.theta && <th className="text-right py-2.5 px-2 text-blue-400/70">Theta</th>}
                        {cols.gamma && <th className="text-right py-2.5 px-2 text-blue-400/70">Gamma</th>}
                        {cols.delta && <th className="text-right py-2.5 px-2 text-blue-400/70">Delta</th>}
                        {cols.volume && <th className="text-right py-2.5 px-2 text-blue-400/70">Volume</th>}
                        <th className="text-right py-2.5 px-3 text-blue-400/90 font-bold">CE OI</th>
                        <th className="text-right py-2.5 px-2 text-blue-400/90 font-bold">ΔOI</th>
                        <th className="text-right py-2.5 px-2 text-blue-400/90 font-bold">IV%</th>
                        <th className="text-right py-2.5 px-3 text-blue-400 font-bold">CE LTP</th>

                        <th className="text-center py-2.5 px-4 font-black text-white bg-zinc-800/40">STRIKE</th>

                        <th className="text-left py-2.5 px-3 text-orange-400 font-bold">PE LTP</th>
                        <th className="text-left py-2.5 px-2 text-orange-400/90 font-bold">IV%</th>
                        <th className="text-left py-2.5 px-2 text-orange-400/90 font-bold">ΔOI</th>
                        <th className="text-left py-2.5 px-3 text-orange-400/90 font-bold">PE OI</th>
                        {cols.volume && <th className="text-left py-2.5 px-2 text-orange-400/70">Volume</th>}
                        {cols.delta && <th className="text-left py-2.5 px-2 text-orange-400/70">Delta</th>}
                        {cols.gamma && <th className="text-left py-2.5 px-2 text-orange-400/70">Gamma</th>}
                        {cols.theta && <th className="text-left py-2.5 px-2 text-orange-400/70">Theta</th>}
                        {cols.vega && <th className="text-left py-2.5 px-2 text-orange-400/70">Vega</th>}
                        {cols.bidAsk && <th className="text-left py-2.5 px-2 text-orange-400/70">Bid/Ask</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row) => {
                        const isATM = row.strike === chainData.atm_strike;
                        const isCallWall = row.strike === chainData.call_wall;
                        const isPutWall = row.strike === chainData.put_wall;

                        return (
                          <tr
                            key={row.strike}
                            className={`border-b border-zinc-800/50 transition-colors font-mono cursor-pointer ${
                              isATM
                                ? "bg-amber-500/10 hover:bg-amber-500/15"
                                : isCallWall
                                ? "bg-blue-500/5 hover:bg-blue-500/10"
                                : isPutWall
                                ? "bg-orange-500/5 hover:bg-orange-500/10"
                                : "hover:bg-zinc-800/40"
                            }`}
                          >
                            {/* CE Optional Columns */}
                            {cols.bidAsk && <td className="py-2 px-2 text-right text-zinc-400">₹{row.ce_bid || "—"}/{row.ce_ask || "—"}</td>}
                            {cols.vega && <td className="py-2 px-2 text-right text-cyan-400">{row.ce_vega.toFixed(1)}</td>}
                            {cols.theta && <td className="py-2 px-2 text-right text-red-400">{row.ce_theta.toFixed(1)}</td>}
                            {cols.gamma && <td className="py-2 px-2 text-right text-fuchsia-400">{row.ce_gamma.toFixed(4)}</td>}
                            {cols.delta && <td className="py-2 px-2 text-right text-blue-300">{row.ce_delta.toFixed(2)}</td>}
                            {cols.volume && <td className="py-2 px-2 text-right text-zinc-300">{fmtOI(row.ce_volume)}</td>}

                            {/* Core CE */}
                            <td className="py-2 px-3 text-right" onClick={() => openRowDrawer(row, "CE")}>
                              <div className="text-blue-300 font-bold">{fmtOI(row.ce_oi)}</div>
                              <OIBar value={row.ce_oi} max={maxCeOI} side="ce" />
                            </td>
                            <td
                              className={`py-2 px-2 text-right font-medium ${row.ce_doi > 0 ? "text-emerald-400" : row.ce_doi < 0 ? "text-red-400" : "text-zinc-500"}`}
                              onClick={() => openRowDrawer(row, "CE")}
                            >
                              {row.ce_doi > 0 ? "+" : ""}{fmtOI(row.ce_doi)}
                            </td>
                            <td className="py-2 px-2 text-right text-blue-300/70" onClick={() => openRowDrawer(row, "CE")}>
                              {row.ce_iv.toFixed(1)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-white hover:text-blue-400" onClick={() => openRowDrawer(row, "CE")}>
                              ₹{fmt(row.ce_ltp, 1)}
                            </td>

                            {/* STRIKE */}
                            <td
                              className={`py-2 px-4 text-center font-black transition-all ${
                                isATM
                                  ? "bg-amber-400 text-zinc-950 font-sans shadow-md"
                                  : isCallWall
                                  ? "text-blue-400 bg-blue-500/10"
                                  : isPutWall
                                  ? "text-orange-400 bg-orange-500/10"
                                  : "text-zinc-200"
                              }`}
                              onClick={() => {
                                setEvidenceItem({
                                  title: `Strike ${fmt(row.strike)} Level`,
                                  strike: row.strike,
                                  levelType: isATM ? "At-The-Money Anchor" : isCallWall ? "Call Wall (Resistance)" : isPutWall ? "Put Wall (Support)" : "Positioning Zone",
                                  ceOI: row.ce_oi,
                                  peOI: row.pe_oi,
                                  doi: row.ce_doi + row.pe_doi,
                                  volume: row.ce_volume + row.pe_volume,
                                  distFromATM: Math.abs(row.strike - chainData.atm_strike),
                                  score: row.liquidity_score || 70,
                                  summary: `Strike ${fmt(row.strike)} exhibits ${fmtOI(row.ce_oi)} Call OI vs ${fmtOI(row.pe_oi)} Put OI with total volume of ${fmtOI(row.ce_volume + row.pe_volume)}.`,
                                });
                              }}
                            >
                              {fmt(row.strike)}
                              {isATM && <span className="ml-1 text-[9px] font-bold">ATM</span>}
                            </td>

                            {/* Core PE */}
                            <td className="py-2 px-3 text-left font-bold text-white hover:text-orange-400" onClick={() => openRowDrawer(row, "PE")}>
                              ₹{fmt(row.pe_ltp, 1)}
                            </td>
                            <td className="py-2 px-2 text-left text-orange-300/70" onClick={() => openRowDrawer(row, "PE")}>
                              {row.pe_iv.toFixed(1)}
                            </td>
                            <td
                              className={`py-2 px-2 text-left font-medium ${row.pe_doi > 0 ? "text-emerald-400" : row.pe_doi < 0 ? "text-red-400" : "text-zinc-500"}`}
                              onClick={() => openRowDrawer(row, "PE")}
                            >
                              {row.pe_doi > 0 ? "+" : ""}{fmtOI(row.pe_doi)}
                            </td>
                            <td className="py-2 px-3 text-left" onClick={() => openRowDrawer(row, "PE")}>
                              <div className="text-orange-300 font-bold">{fmtOI(row.pe_oi)}</div>
                              <OIBar value={row.pe_oi} max={maxPeOI} side="pe" />
                            </td>

                            {/* PE Optional Columns */}
                            {cols.volume && <td className="py-2 px-2 text-left text-zinc-300">{fmtOI(row.pe_volume)}</td>}
                            {cols.delta && <td className="py-2 px-2 text-left text-orange-300">{row.pe_delta.toFixed(2)}</td>}
                            {cols.gamma && <td className="py-2 px-2 text-left text-fuchsia-400">{row.pe_gamma.toFixed(4)}</td>}
                            {cols.theta && <td className="py-2 px-2 text-left text-red-400">{row.pe_theta.toFixed(1)}</td>}
                            {cols.vega && <td className="py-2 px-2 text-left text-cyan-400">{row.pe_vega.toFixed(1)}</td>}
                            {cols.bidAsk && <td className="py-2 px-2 text-left text-zinc-400">₹{row.pe_bid || "—"}/{row.pe_ask || "—"}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: 200-LEVEL ORDER FLOW ──────────────────────────────────── */}
            {activeTab === "orderflow" && (
              <OrderFlow200
                symbol={symbol}
                expiry={expiry || chainData.expiry}
                atmStrike={chainData.atm_strike}
                strikes={chainData.rows.map((r) => r.strike)}
                initialStrike={orderFlowStrike || chainData.atm_strike}
                initialOptionType={orderFlowOptionType || "CE"}
              />
            )}

            {/* ── TAB: LIQUIDITY MAP ─────────────────────────────────────────── */}
            {activeTab === "liquidity" && (
              <LiquidityMap
                rows={chainData.rows}
                atmStrike={chainData.atm_strike}
                spot={chainData.spot}
                callWall={chainData.call_wall}
                putWall={chainData.put_wall}
                maxPain={chainData.max_pain}
                onSelectStrike={(k) => {
                  const r = chainData.rows.find((x) => x.strike === k);
                  if (r) openRowDrawer(r, k >= chainData.atm_strike ? "CE" : "PE");
                }}
              />
            )}

            {/* ── TAB: OI HEATMAP ────────────────────────────────────────────── */}
            {activeTab === "heatmap" && (
              <OIHeatmap
                rows={chainData.rows}
                atmStrike={chainData.atm_strike}
                spot={chainData.spot}
                callWall={chainData.call_wall}
                putWall={chainData.put_wall}
              />
            )}

            {/* ── TAB: CANDIDATES ────────────────────────────────────────────── */}
            {activeTab === "candidates" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <span>⭐</span> Top Scored Option Contracts
                      <span className={`text-xs font-normal ${biasColor(bias)}`}>({bias} Bias)</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Quantitatively scored (0–100) based on Delta, OI buildup, IV pricing, and liquidity.
                    </p>
                  </div>
                  {loadingCandidates && (
                    <div className="flex items-center gap-2 text-xs text-violet-400 font-bold">
                      <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                      Evaluating contracts...
                    </div>
                  )}
                </div>

                {candidatesData && candidatesData.candidates.length > 0 ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    {candidatesData.candidates.map((c, i) => {
                      const isCE = c.option_type === "CE";
                      return (
                        <div
                          key={`${c.strike}-${c.option_type}`}
                          className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 space-y-4 hover:border-violet-500/50 transition-all shadow-xl flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    #{i + 1} Candidate
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${isCE ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-orange-500/20 text-orange-400 border-orange-500/30"}`}>
                                    {c.option_type}
                                  </span>
                                </div>
                                <h3 className="text-2xl font-black text-white font-mono">
                                  {fmt(c.strike)} {c.option_type}
                                </h3>
                                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                                  Premium: <strong className="text-white">₹{fmt(c.ltp, 2)}</strong> · Δ {c.delta.toFixed(2)}
                                </div>
                              </div>

                              {/* Score Badge */}
                              <div className="text-center bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                                <div className="text-[9px] text-zinc-500 uppercase font-bold">Option Score</div>
                                <div className="text-xl font-black text-violet-400 font-mono">{Math.round(c.score)}<span className="text-[10px] text-zinc-500">/100</span></div>
                              </div>
                            </div>

                            {/* Quantitative Score Components */}
                            <div className="grid grid-cols-5 gap-1.5 p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 text-center font-mono">
                              <div>
                                <div className="text-[8px] text-zinc-500">DELTA</div>
                                <div className="text-xs font-bold text-white">{c.score_breakdown.delta}</div>
                              </div>
                              <div>
                                <div className="text-[8px] text-zinc-500">OI</div>
                                <div className="text-xs font-bold text-white">{c.score_breakdown.oi}</div>
                              </div>
                              <div>
                                <div className="text-[8px] text-zinc-500">ΔOI</div>
                                <div className="text-xs font-bold text-white">{c.score_breakdown.oi_change}</div>
                              </div>
                              <div>
                                <div className="text-[8px] text-zinc-500">IV</div>
                                <div className="text-xs font-bold text-white">{c.score_breakdown.iv}</div>
                              </div>
                              <div>
                                <div className="text-[8px] text-zinc-500">LIQUIDITY</div>
                                <div className="text-xs font-bold text-white">{c.score_breakdown.liquidity}</div>
                              </div>
                            </div>

                            {/* Reaction Zones (Analytical) */}
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                              <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                                <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Target Reaction Area</div>
                                <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">₹{fmt(c.targets.T1, 1)}</div>
                              </div>
                              <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800">
                                <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Potential Invalidation</div>
                                <div className="text-xs font-mono font-bold text-red-400 mt-0.5 truncate" title={c.invalidation}>
                                  {c.invalidation}
                                </div>
                              </div>
                            </div>

                            {/* AI Review Snippet */}
                            {c.ai_review && (
                              <div className="p-3 bg-violet-500/10 border border-violet-500/25 rounded-xl space-y-1 mt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">
                                    ✨ AI Validation Status
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${c.ai_status === "PASS" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                    {c.ai_status || "ANALYSIS"}
                                  </span>
                                </div>
                                <p className="text-zinc-300 text-[11px] leading-relaxed line-clamp-2">
                                  {c.ai_review}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                            <button
                              onClick={() => openCandidateDrawer(c)}
                              className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              Inspect Details
                            </button>
                            <button
                              onClick={() => setBacktestOption({
                                strike: c.strike,
                                option_type: c.option_type,
                                ltp: c.ltp,
                                delta: c.delta,
                                gamma: c.gamma,
                                theta: c.theta,
                                vega: c.vega,
                                iv: c.iv,
                                oi: c.oi,
                                oi_change: c.oi_change,
                                volume: c.volume,
                                score: c.score,
                                symbol: chainData.symbol,
                                spot: chainData.spot,
                                expiry: chainData.expiry,
                              })}
                              className="px-3 py-2 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 border border-violet-500/40 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              🧪 Backtest
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !loadingCandidates ? (
                  <div className="p-12 text-center bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <h3 className="text-white font-bold">No candidates found</h3>
                    <p className="text-zinc-500 text-xs mt-1">Try toggling bias or checking a different expiry.</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── TAB: AI REVIEW ─────────────────────────────────────────────── */}
            {activeTab === "aireview" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <span>✨</span> Institutional AI Options Validation Engine
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Rigorous quantitative challenge layer. Identifies structural signal conflicts without fabricating market data.
                    </p>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded-full font-bold">
                    Zero-Hallucination Guardrail
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(candidatesData?.candidates || []).map((c) => (
                    <div key={c.strike} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-mono font-black text-white">
                          {c.strike} {c.option_type}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded border ${
                          c.ai_status === "PASS"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }`}>
                          {c.ai_status || "ANALYZED"}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                        {c.ai_review || c.explanation}
                      </div>

                      {c.ai_conflicts && c.ai_conflicts.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                            Potential Conflict Flags:
                          </span>
                          {c.ai_conflicts.map((conf, idx) => (
                            <div key={idx} className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
                              <span>⚠️</span>
                              <span>{conf}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 flex justify-between text-[11px] text-zinc-500 border-t border-zinc-800">
                        <span>Checklist: <strong className="text-zinc-300">{c.evidence_score} Passed</strong></span>
                        <span>Option Score: <strong className="text-violet-400">{Math.round(c.score)}/100</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
        <OptionDetailsDrawer
          data={drawerData}
          onClose={() => setDrawerData(null)}
          onOpenBacktest={(opt) => setBacktestOption(opt)}
          onOpenOrderFlow={(strike, optionType) => {
            setOrderFlowStrike(strike);
            setOrderFlowOptionType(optionType);
            setActiveTab("orderflow");
          }}
        />

        <BacktestModal
          option={backtestOption}
          onClose={() => setBacktestOption(null)}
        />

        <EvidenceModal
          item={evidenceItem}
          onClose={() => setEvidenceItem(null)}
        />
      </div>
    </MainLayout>
  );
}
