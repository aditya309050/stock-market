from __future__ import annotations

import asyncio
import json
from typing import Any

from app.schemas.nse_screener import NSEScanFilters, NSEScanRequest, NSEScanResponse, NSEScanResult
from app.services.indicators.engine import latest_signals
from app.services.nse.client import nse_client

AUTO_TIMEFRAMES = ["1d", "1h", "2h"]
MIN_SCORE = 45.0
TOP_RESULTS = 30


def _tags_from_signals(s: dict) -> list[str]:
    mapping = [
        ("swing_high_breakout", "Swing high breakout"),
        ("resistance_breakout", "Resistance breakout"),
        ("volume_breakout", "Volume breakout"),
        ("consolidation_breakout", "Consolidation breakout"),
        ("macd_bullish_cross", "MACD bull cross"),
        ("above_ema20", "Above EMA 20"),
        ("above_ema50", "Above EMA 50"),
        ("above_ema200", "Above EMA 200"),
        ("above_vwap", "Above VWAP"),
        ("high_volume", "High volume"),
        ("supertrend_bull", "Supertrend bullish"),
        ("bullish_engulfing", "Bullish engulfing"),
        ("gap_up", "Gap up"),
    ]
    return [label for key, label in mapping if s.get(key)]


def _score_signals(s: dict) -> float:
    """0–100 score from all computed indicators."""
    score = 0.0
    weights = [
        ("swing_high_breakout", 18),
        ("resistance_breakout", 12),
        ("volume_breakout", 10),
        ("consolidation_breakout", 8),
        ("macd_bullish_cross", 12),
        ("above_ema20", 6),
        ("above_ema50", 8),
        ("above_ema200", 10),
        ("above_vwap", 5),
        ("high_volume", 8),
        ("supertrend_bull", 10),
        ("bullish_engulfing", 6),
        ("gap_up", 4),
    ]
    for key, pts in weights:
        if s.get(key):
            score += pts

    rsi = s.get("rsi")
    if rsi is not None:
        if 45 <= rsi <= 65:
            score += 8
        elif rsi < 30:
            score += 4
        elif rsi > 70:
            score -= 5

    adx = s.get("adx")
    if adx is not None and adx >= 20:
        score += 6

    if s.get("swing_low_breakout") or s.get("bearish_engulfing") or s.get("gap_down"):
        score -= 12

    return max(0.0, min(score, 100.0))


def _swing_label(score: float, s: dict) -> str:
    if s.get("swing_low_breakout") or s.get("bearish_engulfing"):
        return "Avoid"
    if score >= 75:
        return "Strong swing buy"
    if score >= 60:
        return "Swing buy"
    if score >= 45:
        return "Watch"
    return "Neutral"


def _score_multi_tf(tf_signals: dict[str, dict]) -> tuple[float, list[str], str]:
    scores = [_score_signals(s) for s in tf_signals.values()]
    if not scores:
        return 0.0, [], "Neutral"
    avg = sum(scores) / len(scores)
    primary = tf_signals.get("1d") or next(iter(tf_signals.values()))
    # Boost when multiple timeframes agree on breakouts
    breakout_tfs = sum(
        1
        for s in tf_signals.values()
        if s.get("swing_high_breakout") or s.get("resistance_breakout")
    )
    if breakout_tfs >= 2:
        avg = min(100.0, avg + 8)
    tags = _tags_from_signals(primary)
    label = _swing_label(avg, primary)
    return round(avg, 1), tags, label


class NSEScanner:
    async def _scan_symbol(self, symbol: str, timeframes: list[str]) -> NSEScanResult | None:
        tf_signals: dict[str, dict] = {}
        for tf in timeframes:
            df = await nse_client.fetch_ohlc(symbol, tf, limit=120)
            if df.empty or len(df) < 30:
                continue
            tf_signals[tf] = latest_signals(df)

        if not tf_signals:
            return None

        score, tags, label = _score_multi_tf(tf_signals)
        if score < MIN_SCORE:
            return None

        return NSEScanResult(
            symbol=symbol,
            matched_timeframes=list(tf_signals.keys()),
            signals_by_tf=tf_signals,
            ai_score=score,
            swing_signal=label,
            swing_tags=tags,
        )

    async def scan(self, request: NSEScanRequest) -> NSEScanResponse:
        f = request.filters
        symbols = request.symbols or await nse_client.get_index_symbols(f.index)
        timeframes = AUTO_TIMEFRAMES if f.auto else f.timeframes

        sem = asyncio.Semaphore(10)

        async def run_one(sym: str) -> NSEScanResult | None:
            async with sem:
                return await self._scan_symbol(sym, timeframes)

        chunks = await asyncio.gather(*[run_one(s) for s in symbols])
        results = [r for r in chunks if r is not None]
        results.sort(key=lambda r: r.ai_score or 0, reverse=True)
        top = results[:TOP_RESULTS]

        return NSEScanResponse(scanned=len(symbols), matched=len(results), results=top)

    def filters_to_json(self, f: NSEScanFilters) -> str:
        return json.dumps(f.model_dump())


nse_scanner = NSEScanner()
