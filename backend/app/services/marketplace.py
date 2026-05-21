"""
Marketplace service — handles strategy publishing, discovery, and subscriptions.
"""
from typing import List, Dict, Any


class MarketplaceService:
    async def list_published(self, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """Return a paginated list of publicly available strategies."""
        # Mock marketplace data
        return [
            {
                "id": 1,
                "title": "Momentum Breakout Pro",
                "author": "trader_alpha",
                "monthly_return": 8.3,
                "total_subscribers": 142,
                "description": "High-frequency momentum strategy targeting intraday breakouts on large-cap tech.",
            },
            {
                "id": 2,
                "title": "Mean Reversion V2",
                "author": "quant_lab",
                "monthly_return": 4.1,
                "total_subscribers": 87,
                "description": "Statistical mean reversion on mid-cap equities with RSI and Bollinger Bands.",
            },
            {
                "id": 3,
                "title": "AI Sentiment Swing",
                "author": "ai_trader",
                "monthly_return": 11.7,
                "total_subscribers": 320,
                "description": "Uses NLP sentiment scoring on news feeds to time swing entries.",
            },
        ][skip : skip + limit]

    async def publish_strategy(self, author_id: int, strategy_id: int, title: str, description: str) -> Dict[str, Any]:
        """Publish a user's private strategy to the marketplace."""
        return {
            "status": "published",
            "strategy_id": strategy_id,
            "title": title,
            "author_id": author_id,
        }


marketplace_service = MarketplaceService()
