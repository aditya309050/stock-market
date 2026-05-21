"""
AI Market Analyst Agent — autonomous node in the LangGraph workflow.
Consumes market data and produces structured analysis.
"""
from typing import Dict, Any
from app.agents.memory import agent_memory


async def analyst_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: analyses a symbol using price context and memory.
    
    Input state keys:
        symbol      – ticker to analyse
        price_data  – recent OHLCV list (optional)
        sentiment   – latest sentiment score (optional)
    
    Output: updates state with `analysis` dict.
    """
    symbol = state.get("symbol", "UNKNOWN")
    price_data = state.get("price_data", [])
    sentiment = state.get("sentiment", 0.0)

    # ── Mock analysis (replace with real LLM call) ──────────────
    if len(price_data) >= 2:
        trend = "bullish" if price_data[-1] > price_data[-2] else "bearish"
    else:
        trend = "neutral"

    analysis = {
        "symbol": symbol,
        "trend": trend,
        "sentiment_score": sentiment,
        "support_level": min(price_data) if price_data else 0,
        "resistance_level": max(price_data) if price_data else 0,
        "summary": f"{symbol} shows a {trend} trend with sentiment {sentiment:.2f}. "
                   f"Key support at {min(price_data) if price_data else 'N/A'}, "
                   f"resistance at {max(price_data) if price_data else 'N/A'}.",
    }

    # Persist analysis into long-term memory
    await agent_memory.add(
        text=analysis["summary"],
        metadata={"symbol": symbol, "type": "analysis"},
    )

    return {**state, "analysis": analysis}
