"""
LangGraph workflow that orchestrates the multi-agent trading pipeline.

Flow:
    MarketData ──▶ Analyst ──▶ RiskManager ──▶ StrategyGenerator ──▶ Decision
    
Each node is an async function that reads/writes to a shared state dict.
When LangGraph is installed, this compiles into a real StateGraph.
Without the dependency it falls back to a simple sequential executor.
"""
import logging
from typing import Dict, Any

from app.agents.analyst import analyst_node
from app.agents.risk_manager import risk_manager_node
from app.agents.strategy_generator import strategy_generator_node

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
#  Try to build a real LangGraph StateGraph; fall back gracefully
# ──────────────────────────────────────────────────────────────
_compiled_graph = None

try:
    from langgraph.graph import StateGraph, END

    builder = StateGraph(dict)
    builder.add_node("analyst", analyst_node)
    builder.add_node("risk_manager", risk_manager_node)
    builder.add_node("strategy_generator", strategy_generator_node)

    builder.set_entry_point("analyst")
    builder.add_edge("analyst", "risk_manager")
    builder.add_edge("risk_manager", "strategy_generator")
    builder.add_edge("strategy_generator", END)

    _compiled_graph = builder.compile()
    logger.info("LangGraph multi-agent workflow compiled successfully")

except ImportError:
    logger.warning("langgraph not installed — using sequential fallback executor")


async def run_agent_pipeline(
    symbol: str,
    price_data: list[float] | None = None,
    sentiment: float = 0.0,
    account_balance: float = 100_000,
    risk_tolerance: str = "medium",
) -> Dict[str, Any]:
    """
    Execute the full multi-agent pipeline for a given symbol.
    Returns the final state containing analysis, risk_verdict, and strategy_proposal.
    """
    initial_state: Dict[str, Any] = {
        "symbol": symbol,
        "price_data": price_data or [],
        "sentiment": sentiment,
        "account_balance": account_balance,
        "risk_tolerance": risk_tolerance,
    }

    if _compiled_graph is not None:
        # Real LangGraph execution
        result = await _compiled_graph.ainvoke(initial_state)
        return result

    # Fallback: run nodes sequentially
    state = initial_state
    state = await analyst_node(state)
    state = await risk_manager_node(state)
    state = await strategy_generator_node(state)
    return state
