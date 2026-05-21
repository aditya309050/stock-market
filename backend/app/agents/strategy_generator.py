"""
AI Strategy Generator Agent — proposes new trading strategies
based on market conditions and historical performance.
"""
from typing import Dict, Any
from app.agents.memory import agent_memory


async def strategy_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: generates a strategy proposal from analysis context.
    
    Input state keys:
        analysis      – output from analyst_node
        risk_verdict  – output from risk_manager_node
    
    Output: updates state with `strategy_proposal`.
    """
    analysis = state.get("analysis", {})
    risk = state.get("risk_verdict", {})
    symbol = analysis.get("symbol", "UNKNOWN")
    trend = analysis.get("trend", "neutral")

    # ── Strategy proposal logic ─────────────────────────────────
    if not risk.get("approved", False):
        proposal = {
            "action": "HOLD",
            "strategy_type": "none",
            "reasoning": "Risk manager blocked trading — holding position.",
            "parameters": {},
        }
    elif trend == "bullish":
        proposal = {
            "action": "BUY",
            "strategy_type": "momentum_breakout",
            "reasoning": f"{symbol} is trending bullish. Enter on breakout above resistance "
                         f"at {analysis.get('resistance_level', 'N/A')} with a tight stop at "
                         f"{risk.get('stop_loss', 'N/A')}.",
            "parameters": {
                "entry_type": "limit",
                "entry_price": analysis.get("resistance_level", 0),
                "stop_loss": risk.get("stop_loss", 0),
                "qty": risk.get("suggested_qty", 1),
                "timeframe": "1h",
            },
        }
    else:
        proposal = {
            "action": "SELL" if trend == "bearish" else "HOLD",
            "strategy_type": "mean_reversion" if trend == "bearish" else "wait",
            "reasoning": f"{symbol} is {trend}. Waiting for a clearer signal.",
            "parameters": {},
        }

    # Persist the generated strategy to memory
    await agent_memory.add(
        text=f"Generated {proposal['strategy_type']} strategy for {symbol}: {proposal['reasoning']}",
        metadata={"symbol": symbol, "type": "strategy_proposal"},
    )

    return {**state, "strategy_proposal": proposal}
