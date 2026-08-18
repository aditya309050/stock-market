from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import pandas as pd
import numpy as np


@dataclass
class DMAMetrics:
    symbol: str
    last_price: float
    dma20: float
    dma50: float
    dma200: float
    prev_dma50: float
    prev_dma200: float
    gap_pct: float             # Gap between 50 DMA and 200 DMA
    dist_50_pct: float         # Distance % from current price to 50 DMA
    dist_200_pct: float        # Distance % from current price to 200 DMA
    dma50_slope: float         # 5-bar slope % of 50 DMA
    dma50_slope_trend: str     # "Rising", "Falling", "Flat"
    dma200_slope: float        # 5-bar slope % of 200 DMA
    dma200_slope_trend: str    # "Rising", "Falling", "Flat"
    rsi: float                 # 14-period RSI
    volume_mult: float         # Volume vs 20-period Average Volume
    is_golden_cross: bool      # True if 50 DMA > 200 DMA
    is_crossed_today: bool     # Crossed today
    is_recent_cross: bool      # Crossed within last 5 bars
    is_established_cross: bool # Established Golden Cross
    is_near_cross: bool        # Near 50/200 DMA cross
    is_above_200: bool
    is_above_50: bool
    status: str                # "provisional" or "confirmed"
    cross_category: str        # "CROSSED", "VERY_NEAR", "NEAR", "APPROACHING", "EARLY"
    setup_category: str        # "STRONG_SETUP", "CONFLUENCE", "NEAR_50_DMA", "NEAR_200_DMA", "BREAKOUT_WATCH"
    score: float


def _calculate_rsi(series: pd.Series, period: int = 14) -> float:
    if len(series) < period + 1:
        return 50.0
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    last_g = avg_gain.iloc[-1]
    last_l = avg_loss.iloc[-1]
    if pd.isna(last_g) or pd.isna(last_l) or last_l == 0:
        return 100.0 if (last_g and last_g > 0) else 50.0
    rs = last_g / last_l
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return float(np.clip(rsi, 0.0, 100.0))


def calculate_dma_metrics(
    df: pd.DataFrame, symbol: str, live_price: float | None = None, is_intraday: bool = False
) -> DMAMetrics | None:
    """
    Computes 20, 50, and 200 DMAs, slopes, RSI, volume average multiplier, and setup score.
    """
    if df is None or len(df) < 20:
        return None

    closes = df["close"].copy()
    volumes = df["volume"].copy()

    if live_price is not None and live_price > 0:
        if is_intraday:
            closes = pd.concat([closes, pd.Series([live_price])], ignore_index=True)
        else:
            closes.iloc[-1] = live_price

    if len(closes) < 20:
        return None

    sma20_series = closes.rolling(window=20).mean()
    sma50_series = closes.rolling(window=50).mean() if len(closes) >= 50 else pd.Series([None] * len(closes))
    sma200_series = closes.rolling(window=200).mean() if len(closes) >= 200 else pd.Series([None] * len(closes))
    vol20_series = volumes.rolling(window=20).mean()

    curr_close = float(closes.iloc[-1])
    curr_vol = float(volumes.iloc[-1]) if len(volumes) > 0 else 0.0
    avg_vol = float(vol20_series.iloc[-1]) if pd.notna(vol20_series.iloc[-1]) and vol20_series.iloc[-1] > 0 else curr_vol

    curr_dma20 = float(sma20_series.iloc[-1]) if pd.notna(sma20_series.iloc[-1]) else curr_close
    curr_dma50 = float(sma50_series.iloc[-1]) if pd.notna(sma50_series.iloc[-1]) else curr_dma20
    curr_dma200 = float(sma200_series.iloc[-1]) if pd.notna(sma200_series.iloc[-1]) else curr_dma50 * 0.98

    prev_dma50 = float(sma50_series.iloc[-2]) if len(sma50_series) >= 2 and pd.notna(sma50_series.iloc[-2]) else curr_dma50
    prev_dma200 = float(sma200_series.iloc[-2]) if len(sma200_series) >= 2 and pd.notna(sma200_series.iloc[-2]) else curr_dma200

    # 5-bar DMA Slopes (%)
    idx_5d = max(0, len(sma50_series) - 6)
    dma50_5d_ago = float(sma50_series.iloc[idx_5d]) if pd.notna(sma50_series.iloc[idx_5d]) else curr_dma50
    dma200_5d_ago = float(sma200_series.iloc[idx_5d]) if pd.notna(sma200_series.iloc[idx_5d]) else curr_dma200

    dma50_slope = float(((curr_dma50 - dma50_5d_ago) / dma50_5d_ago) * 100.0) if dma50_5d_ago > 0 else 0.0
    dma200_slope = float(((curr_dma200 - dma200_5d_ago) / dma200_5d_ago) * 100.0) if dma200_5d_ago > 0 else 0.0

    dma50_slope_trend = "Rising" if dma50_slope > 0.1 else ("Falling" if dma50_slope < -0.1 else "Flat")
    dma200_slope_trend = "Rising" if dma200_slope > 0.05 else ("Falling" if dma200_slope < -0.05 else "Flat")

    rsi_14 = _calculate_rsi(closes)
    volume_mult = round(curr_vol / avg_vol, 2) if avg_vol > 0 else 1.0

    # Distances
    dist_50_pct = round(((curr_close - curr_dma50) / curr_dma50) * 100.0, 2) if curr_dma50 > 0 else 0.0
    dist_200_pct = round(((curr_close - curr_dma200) / curr_dma200) * 100.0, 2) if curr_dma200 > 0 else 0.0

    # Golden Cross state
    is_golden_cross = (curr_dma50 > curr_dma200)
    gap_pct = round(abs(curr_dma50 - curr_dma200) / curr_dma200 * 100.0, 2) if curr_dma200 > 0 else 0.0

    is_crossed_today = (prev_dma50 <= prev_dma200) and is_golden_cross
    is_recent_cross = False
    if is_golden_cross and not is_crossed_today:
        for i in range(2, min(7, len(sma50_series))):
            p50 = sma50_series.iloc[-i]
            p200 = sma200_series.iloc[-i]
            prev_p50 = sma50_series.iloc[-i - 1] if i + 1 <= len(sma50_series) else p50
            prev_p200 = sma200_series.iloc[-i - 1] if i + 1 <= len(sma200_series) else p200

            if pd.notna(p50) and pd.notna(p200) and pd.notna(prev_p50) and pd.notna(prev_p200):
                if prev_p50 <= prev_p200 and p50 > p200:
                    is_recent_cross = True
                    break

    is_established_cross = is_golden_cross and not is_crossed_today and not is_recent_cross
    is_near_cross = (not is_golden_cross) and (0.0 <= gap_pct <= 3.0)

    if is_golden_cross:
        cross_category = "CROSSED"
    elif gap_pct <= 1.0:
        cross_category = "VERY_NEAR"
    elif gap_pct <= 3.0:
        cross_category = "NEAR"
    elif gap_pct <= 5.0:
        cross_category = "APPROACHING"
    else:
        cross_category = "EARLY"

    status = "provisional" if is_intraday else "confirmed"

    # Setup Score Engine (0 - 100)
    score = 45.0

    # 1. Proximity to 50 DMA (sweet spot within ±2%)
    if abs(dist_50_pct) <= 1.0:
        score += 20.0
    elif abs(dist_50_pct) <= 2.5:
        score += 15.0
    elif abs(dist_50_pct) <= 4.0:
        score += 8.0

    # 2. Rising DMAs
    if dma50_slope > 0.1:
        score += 10.0
    if dma200_slope > 0.05:
        score += 10.0

    # 3. RSI rating (50 - 65 momentum zone)
    if 50.0 <= rsi_14 <= 65.0:
        score += 10.0
    elif 40.0 <= rsi_14 < 50.0 or 65.0 < rsi_14 <= 70.0:
        score += 5.0

    # 4. Volume Confirmation
    if volume_mult >= 1.5:
        score += 10.0
    elif volume_mult >= 1.2:
        score += 5.0

    # 5. Golden Cross or Position Above 200 DMA
    if curr_close > curr_dma200:
        score += 5.0
    if is_golden_cross:
        score += 5.0

    score = max(0.0, min(round(score, 1), 100.0))

    # Setup Category determination
    if score >= 80:
        setup_category = "STRONG_SETUP"
    elif abs(dist_50_pct) <= 2.0:
        setup_category = "NEAR_50_DMA"
    elif abs(dist_200_pct) <= 2.0:
        setup_category = "NEAR_200_DMA"
    elif volume_mult >= 1.5 and rsi_14 >= 55:
        setup_category = "BREAKOUT_WATCH"
    else:
        setup_category = "NEAR_50_DMA"

    return DMAMetrics(
        symbol=symbol,
        last_price=round(curr_close, 2),
        dma20=round(curr_dma20, 2),
        dma50=round(curr_dma50, 2),
        dma200=round(curr_dma200, 2),
        prev_dma50=round(prev_dma50, 2),
        prev_dma200=round(prev_dma200, 2),
        gap_pct=round(gap_pct, 2),
        dist_50_pct=dist_50_pct,
        dist_200_pct=dist_200_pct,
        dma50_slope=round(dma50_slope, 2),
        dma50_slope_trend=dma50_slope_trend,
        dma200_slope=round(dma200_slope, 2),
        dma200_slope_trend=dma200_slope_trend,
        rsi=round(rsi_14, 1),
        volume_mult=volume_mult,
        is_golden_cross=is_golden_cross,
        is_crossed_today=is_crossed_today,
        is_recent_cross=is_recent_cross,
        is_established_cross=is_established_cross,
        is_near_cross=is_near_cross,
        is_above_200=curr_close > curr_dma200,
        is_above_50=curr_close > curr_dma50,
        status=status,
        cross_category=cross_category,
        setup_category=setup_category,
        score=score,
    )
