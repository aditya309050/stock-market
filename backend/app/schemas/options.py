"""Pydantic schemas for the F&O Options Engine."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


class ScoreBreakdown(BaseModel):
    delta: float
    oi: float
    oi_change: float
    iv: float
    liquidity: float


class EvidenceCheck(BaseModel):
    label: str
    passed: bool = True

    class Config:
        populate_by_name = True

    @classmethod
    def from_dict(cls, d: dict) -> "EvidenceCheck":
        return cls(label=d["label"], passed=d.get("pass", True))


class OptionChainRow(BaseModel):
    strike: float
    ce_oi: int
    ce_doi: int
    ce_ltp: float
    ce_iv: float
    ce_volume: int
    ce_delta: float
    ce_gamma: float
    ce_theta: float
    ce_vega: float
    pe_oi: int
    pe_doi: int
    pe_ltp: float
    pe_iv: float
    pe_volume: int
    pe_delta: float
    pe_gamma: float
    pe_theta: float
    pe_vega: float
    liquidity_score: float = 0.0
    liquidity_tag: str = ""
    ce_bid: float = 0.0
    ce_ask: float = 0.0
    pe_bid: float = 0.0
    pe_ask: float = 0.0


class OptionCandidate(BaseModel):
    strike: float
    option_type: str          # "CE" or "PE"
    ltp: float
    delta: float
    gamma: float
    theta: float
    vega: float
    iv: float
    oi: int
    oi_change: int
    volume: int
    score: float
    score_breakdown: dict[str, float]
    checks: list[dict[str, Any]]
    targets: dict[str, float]
    invalidation: str
    explanation: str
    evidence_score: str
    ai_review: str = ""
    ai_status: str = "PASS"   # "PASS", "CONFLICT", "INSUFFICIENT DATA"
    ai_conflicts: list[str] = []
    reasons: list[str] = []
    risk_reward: str = "1:2"
    potential_reaction_zones: dict[str, Any] = {}
    liquidity_score: float = 0.0


class OptionChainResponse(BaseModel):
    symbol: str
    spot: float
    expiry: str
    expiry_dates: list[str]
    atm_strike: float
    pcr: float
    iv_avg: float
    market_bias: str
    total_ce_oi: int
    total_pe_oi: int
    max_pain: float = 0.0
    call_wall: float = 0.0
    put_wall: float = 0.0
    expected_move: float = 0.0
    expected_move_range: list[float] = []
    market_regime: str = "NEUTRAL"
    positioning: str = "Neutral"
    positioning_details: dict[str, Any] = {}
    volatility_regime: str = "Moderate"
    rows: list[OptionChainRow]
    timestamp: str
    is_synthetic: bool = False


class OptionCandidatesResponse(BaseModel):
    symbol: str
    spot: float
    expiry: str
    atm_strike: float
    pcr: float
    iv_avg: float
    market_bias: str
    bias_requested: str
    candidates: list[OptionCandidate]
    timestamp: str
