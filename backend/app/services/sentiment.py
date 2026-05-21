"""
Sentiment analysis service — scrapes headlines and scores them.
In production, integrate a real NLP model or the OpenAI API.
"""
import random
from typing import List, Dict, Any


class SentimentService:
    async def analyze_symbol(self, symbol: str) -> Dict[str, Any]:
        """Return a mock sentiment analysis for a given symbol."""
        headlines = [
            f"{symbol} reports strong quarterly earnings beating estimates",
            f"Analysts upgrade {symbol} after product launch",
            f"{symbol} faces regulatory scrutiny in EU market",
            f"Institutional investors increase {symbol} holdings",
        ]
        chosen = random.choice(headlines)
        score = round(random.uniform(-1.0, 1.0), 3)

        return {
            "symbol": symbol,
            "headline": chosen,
            "sentiment_score": score,
            "label": "bullish" if score > 0.2 else ("bearish" if score < -0.2 else "neutral"),
        }

    async def batch_analyze(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Analyse sentiment for a list of symbols."""
        results = []
        for s in symbols:
            results.append(await self.analyze_symbol(s))
        return results


sentiment_service = SentimentService()
