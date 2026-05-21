"""
AI Risk Manager Agent — evaluates proposed trades for risk compliance.
"""
from typing import Dict, Any


async def risk_manager_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: receives analysis + proposed signal, evaluates risk.
    
    Input state keys:
        analysis            – output from analyst_node
        account_balance     – current cash available
        risk_tolerance      – low | medium | high
    
    Output: updates state with `risk_verdict` dict.
    """
    analysis = state.get("analysis", {})
    balance = state.get("account_balance", 100_000)
    tolerance = state.get("risk_tolerance", "medium")

    trend = analysis.get("trend", "neutral")
    support = analysis.get("support_level", 0)
    resistance = analysis.get("resistance_level", 0)

    # ── Risk scoring logic ──────────────────────────────────────
    risk_score = 0.5  # baseline

    if trend == "bullish":
        risk_score -= 0.15
    elif trend == "bearish":
        risk_score += 0.20

    # Tolerance adjustment
    tolerance_map = {"low": 0.3, "medium": 0.5, "high": 0.8}
    max_risk = tolerance_map.get(tolerance, 0.5)

    approved = risk_score <= max_risk

    # Position sizing: risk at most 2% of balance per trade
    risk_amount = balance * 0.02
    price_range = resistance - support if resistance > support else 1
    suggested_qty = int(risk_amount / price_range) if price_range > 0 else 0

    risk_verdict = {
        "approved": approved,
        "risk_score": round(risk_score, 3),
        "max_allowed_risk": max_risk,
        "suggested_qty": max(suggested_qty, 1),
        "stop_loss": support,
        "reason": "Risk within tolerance" if approved else "Risk exceeds tolerance — trade blocked",
    }

    return {**state, "risk_verdict": risk_verdict}
