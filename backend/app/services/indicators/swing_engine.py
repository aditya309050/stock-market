from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import pandas as pd
import numpy as np


@dataclass
class SwingPivot:
    index: int
    price: float
    pivot_type: str  # "high" or "low"
    is_confirmed: bool


@dataclass
class SwingMetrics:
    symbol: str
    timeframe: str
    last_price: float
    open_price: float
    high_price: float
    low_price: float
    volume: int
    volume_ratio: float      # Current volume / 20-period average volume
    trend: str             # "STRONG UPTREND", "UPTREND", "DOWNTREND", "RANGE"
    structure: str         # "HH + HL", "LH + LL", "SIDEWAYS"
    swing_score: float     # 0 - 100
    setup_category: str    # "BREAKOUT", "PULLBACK", "NEAR RESISTANCE", "NEUTRAL"
    rsi: float
    ema20: float
    ema50: float
    ema200: float
    nearest_resistance: float
    nearest_support: float
    dist_resistance_pct: float
    dist_support_pct: float
    is_breakout: bool
    is_hh_hl: bool
    tags: list[str]


def find_swing_pivots(df: pd.DataFrame, left: int = 2, right: int = 2) -> list[SwingPivot]:
    """
    Identifies Swing Highs and Swing Lows with non-repainting state (DEVELOPING vs CONFIRMED).
    """
    pivots: list[SwingPivot] = []
    if df is None or len(df) < (left + right + 1):
        return pivots

    highs = df["high"].values
    lows = df["low"].values
    n = len(df)

    for i in range(left, n):
        # Check swing high
        is_sh = True
        for j in range(1, left + 1):
            if highs[i - j] >= highs[i]:
                is_sh = False
                break
        
        # Check right side (if available)
        confirmed_sh = is_sh
        if is_sh:
            for j in range(1, right + 1):
                if i + j < n:
                    if highs[i + j] >= highs[i]:
                        confirmed_sh = False
                        break
                else:
                    # Near end of data: developing swing
                    confirmed_sh = False

        if is_sh:
            pivots.append(SwingPivot(index=i, price=float(highs[i]), pivot_type="high", is_confirmed=confirmed_sh))

        # Check swing low
        is_sl = True
        for j in range(1, left + 1):
            if lows[i - j] <= lows[i]:
                is_sl = False
                break

        confirmed_sl = is_sl
        if is_sl:
            for j in range(1, right + 1):
                if i + j < n:
                    if lows[i + j] <= lows[i]:
                        confirmed_sl = False
                        break
                else:
                    confirmed_sl = False

        if is_sl:
            pivots.append(SwingPivot(index=i, price=float(lows[i]), pivot_type="low", is_confirmed=confirmed_sl))

    return pivots


def calculate_swing_metrics(
    df: pd.DataFrame, symbol: str, timeframe: str = "15m"
) -> SwingMetrics | None:
    """
    Calculates technical swing trading setup for a given stock's OHLCV dataframe.
    """
    if df is None or len(df) < 30:
        return None

    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    volumes = df["volume"].values

    curr_close = float(closes[-1])
    curr_open = float(df["open"].values[-1])
    curr_high = float(highs[-1])
    curr_low = float(lows[-1])
    curr_vol = int(volumes[-1])

    # Volume ratio (vs 20-period average)
    avg_vol = float(np.mean(volumes[-20:])) if len(volumes) >= 20 else float(np.mean(volumes))
    vol_ratio = round(curr_vol / avg_vol, 2) if avg_vol > 0 else 1.0

    # EMAs
    s_closes = pd.Series(closes)
    ema20 = float(s_closes.ewm(span=20, adjust=False).mean().iloc[-1])
    ema50 = float(s_closes.ewm(span=50, adjust=False).mean().iloc[-1]) if len(closes) >= 50 else float(ema20 * 0.98)
    ema200 = float(s_closes.ewm(span=200, adjust=False).mean().iloc[-1]) if len(closes) >= 200 else float(ema50 * 0.95)

    # RSI (14)
    delta = s_closes.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi_val = float(100 - (100 / (1 + rs)).iloc[-1]) if len(closes) >= 15 and pd.notna(rs.iloc[-1]) else 50.0

    # Find Swing Pivots
    pivots = find_swing_pivots(df, left=2, right=2)
    sh_pivots = [p for p in pivots if p.pivot_type == "high"]
    sl_pivots = [p for p in pivots if p.pivot_type == "low"]

    # Trend & Market Structure Classification
    is_hh_hl = False
    structure = "SIDEWAYS"
    trend = "RANGE"

    if len(sh_pivots) >= 2 and len(sl_pivots) >= 2:
        last_sh = sh_pivots[-1].price
        prev_sh = sh_pivots[-2].price
        last_sl = sl_pivots[-1].price
        prev_sl = sl_pivots[-2].price

        if last_sh > prev_sh and last_sl > prev_sl:
            structure = "HH + HL"
            trend = "STRONG UPTREND"
            is_hh_hl = True
        elif last_sh < prev_sh and last_sl < prev_sl:
            structure = "LH + LL"
            trend = "DOWNTREND"
        elif last_sl > prev_sl:
            structure = "HIGHER LOW"
            trend = "UPTREND"

    # Support & Resistance
    res_levels = [p.price for p in sh_pivots if p.price >= curr_close]
    sup_levels = [p.price for p in sl_pivots if p.price <= curr_close]

    nearest_res = min(res_levels) if res_levels else float(np.max(highs[-20:]))
    nearest_sup = max(sup_levels) if sup_levels else float(np.min(lows[-20:]))

    dist_res_pct = round(((nearest_res - curr_close) / curr_close) * 100.0, 2) if curr_close > 0 else 0.0
    dist_sup_pct = round(((curr_close - nearest_sup) / curr_close) * 100.0, 2) if curr_close > 0 else 0.0

    # Breakout logic
    recent_swing_high = max([p.price for p in sh_pivots[-3:]]) if sh_pivots else float(np.max(highs[-20:-1]))
    is_breakout = curr_close > recent_swing_high

    # Scoring Algorithm (0 - 100)
    score = 0.0
    tags: list[str] = []

    if is_hh_hl:
        score += 20.0
        tags.append("HH + HL Trend")
    
    if curr_close > ema20:
        score += 10.0
        tags.append("Above 20 EMA")
    
    if curr_close > ema50:
        score += 10.0
        tags.append("Above 50 EMA")

    if ema20 > ema50:
        score += 10.0
        tags.append("20 > 50 EMA")

    if 48.0 <= rsi_val <= 68.0:
        score += 10.0
        tags.append("RSI Bullish (50-65)")

    if vol_ratio >= 1.5:
        score += 15.0
        tags.append(f"Volume Spike {vol_ratio}x")
    elif vol_ratio >= 1.2:
        score += 8.0
        tags.append(f"High Vol {vol_ratio}x")

    if is_breakout:
        score += 20.0
        tags.append("Breakout Above Swing High")

    # Candle strength (closed in top 30% of range)
    candle_range = curr_high - curr_low
    if candle_range > 0 and (curr_close - curr_low) / candle_range >= 0.70:
        score += 5.0
        tags.append("Strong Candle Close")

    score = max(0.0, min(round(score, 1), 100.0))

    # Setup Category Classification
    if is_breakout or score >= 75.0:
        setup_category = "BREAKOUT"
    elif dist_res_pct <= 3.0 and score >= 45.0:
        setup_category = "NEAR RESISTANCE"
    elif dist_sup_pct <= 3.0 and score >= 45.0:
        setup_category = "PULLBACK"
    elif score >= 40.0:
        setup_category = "BULLISH SETUP"
    else:
        setup_category = "NEUTRAL"


    return SwingMetrics(
        symbol=symbol,
        timeframe=timeframe,
        last_price=round(curr_close, 2),
        open_price=round(curr_open, 2),
        high_price=round(curr_high, 2),
        low_price=round(curr_low, 2),
        volume=curr_vol,
        volume_ratio=vol_ratio,
        trend=trend,
        structure=structure,
        swing_score=score,
        setup_category=setup_category,
        rsi=round(rsi_val, 1),
        ema20=round(ema20, 2),
        ema50=round(ema50, 2),
        ema200=round(ema200, 2),
        nearest_resistance=round(nearest_res, 2),
        nearest_support=round(nearest_sup, 2),
        dist_resistance_pct=dist_res_pct,
        dist_support_pct=dist_sup_pct,
        is_breakout=is_breakout,
        is_hh_hl=is_hh_hl,
        tags=tags,
    )
