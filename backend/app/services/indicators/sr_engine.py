from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Any
import numpy as np
import pandas as pd


@dataclass
class SRLevel:
    level_type: str        # "SUPPORT" or "RESISTANCE"
    label: str             # "S1", "S2", "S3", "R1", "R2", "R3"
    price: float
    zone_low: float
    zone_high: float
    distance_pct: float
    strength: float        # 0 - 100
    test_count: int
    reasons: List[str] = field(default_factory=list)


@dataclass
class VolumeProfileData:
    poc: float             # Point of Control (highest volume price)
    vah: float             # Value Area High (70% vol upper bound)
    val: float             # Value Area Low (70% vol lower bound)
    bins: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SRAnalysisResult:
    supports: List[SRLevel]
    resistances: List[SRLevel]
    nearest_support: SRLevel | None
    nearest_resistance: SRLevel | None
    volume_profile: VolumeProfileData
    confluence_tags: List[str]


def calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
    if len(df) < period + 1:
        return float(df["close"].std() or 1.0)
    high = df["high"]
    low = df["low"]
    close = df["close"].shift(1)
    tr = pd.concat([high - low, (high - close).abs(), (low - close).abs()], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean().iloc[-1]
    return float(atr) if pd.notna(atr) and atr > 0 else float(df["close"].iloc[-1] * 0.015)


def calculate_volume_profile(df: pd.DataFrame, num_bins: int = 20) -> VolumeProfileData:
    if df is None or len(df) < 10:
        return VolumeProfileData(poc=0.0, vah=0.0, val=0.0, bins=[])

    prices = df["close"]
    volumes = df["volume"]
    min_p = float(df["low"].min())
    max_p = float(df["high"].max())

    if max_p <= min_p:
        return VolumeProfileData(poc=prices.iloc[-1], vah=prices.iloc[-1], val=prices.iloc[-1], bins=[])

    bins = np.linspace(min_p, max_p, num_bins + 1)
    bin_volumes = np.zeros(num_bins)

    for idx, row in df.iterrows():
        c_price = row["close"]
        c_vol = row["volume"]
        bin_idx = min(num_bins - 1, max(0, int((c_price - min_p) / (max_p - min_p) * num_bins)))
        bin_volumes[bin_idx] += c_vol

    poc_idx = int(np.argmax(bin_volumes))
    poc_price = float((bins[poc_idx] + bins[poc_idx + 1]) / 2.0)

    # 70% Value Area Calculation
    total_vol = float(np.sum(bin_volumes))
    target_vol = total_vol * 0.70

    sorted_indices = np.argsort(bin_volumes)[::-1]
    cum_vol = 0.0
    va_indices = []
    for idx in sorted_indices:
        cum_vol += bin_volumes[idx]
        va_indices.append(idx)
        if cum_vol >= target_vol:
            break

    val_idx = min(va_indices)
    vah_idx = max(va_indices)
    val_price = float((bins[val_idx] + bins[val_idx + 1]) / 2.0)
    vah_price = float((bins[vah_idx] + bins[vah_idx + 1]) / 2.0)

    bin_list = []
    for i in range(num_bins):
        mid = float((bins[i] + bins[i + 1]) / 2.0)
        vol_pct = float(bin_volumes[i] / total_vol * 100.0) if total_vol > 0 else 0.0
        bin_list.append({"price": round(mid, 2), "volume": int(bin_volumes[i]), "vol_pct": round(vol_pct, 1)})

    return VolumeProfileData(
        poc=round(poc_price, 2),
        vah=round(vah_price, 2),
        val=round(val_price, 2),
        bins=bin_list,
    )


def calculate_sr_analysis(
    df: pd.DataFrame,
    curr_price: float,
    dma50: float = 0.0,
    dma200: float = 0.0,
) -> SRAnalysisResult:
    """
    Computes Support & Resistance zones with test count, strength scoring, and Volume Profile.
    """
    if df is None or len(df) < 20:
        empty_vp = VolumeProfileData(poc=curr_price, vah=curr_price, val=curr_price, bins=[])
        return SRAnalysisResult(supports=[], resistances=[], nearest_support=None, nearest_resistance=None, volume_profile=empty_vp, confluence_tags=[])

    atr = calculate_atr(df)
    vp = calculate_volume_profile(df)

    # 1. Identify Swing Highs & Swing Lows
    raw_levels = []
    lookback = min(120, len(df))
    sub_df = df.tail(lookback)

    highs = sub_df["high"].values
    lows = sub_df["low"].values
    closes = sub_df["close"].values

    for i in range(2, len(highs) - 2):
        if highs[i] > highs[i - 1] and highs[i] > highs[i - 2] and highs[i] > highs[i + 1] and highs[i] > highs[i + 2]:
            raw_levels.append({"price": float(highs[i]), "type": "SWING_HIGH"})
        if lows[i] < lows[i - 1] and lows[i] < lows[i - 2] and lows[i] < lows[i + 1] and lows[i] < lows[i + 2]:
            raw_levels.append({"price": float(lows[i]), "type": "SWING_LOW"})

    # Include Volume Profile POC as a level candidate
    if vp.poc > 0:
        raw_levels.append({"price": vp.poc, "type": "VOLUME_POC"})

    # Cluster raw levels within ATR tolerance threshold (~1.0 * ATR)
    clustered = []
    zone_threshold = max(atr * 0.8, curr_price * 0.008)

    for item in raw_levels:
        p = item["price"]
        matched = False
        for c in clustered:
            if abs(c["price"] - p) <= zone_threshold:
                c["count"] += 1
                c["prices"].append(p)
                c["types"].append(item["type"])
                c["price"] = float(np.mean(c["prices"]))
                matched = True
                break
        if not matched:
            clustered.append({"price": p, "count": 1, "prices": [p], "types": [item["type"]]})

    supports = []
    resistances = []

    for c in clustered:
        price = c["price"]
        dist_pct = ((price - curr_price) / curr_price) * 100.0
        zone_low = round(price - zone_threshold * 0.5, 2)
        zone_high = round(price + zone_threshold * 0.5, 2)

        # Count how many candles tested this zone (high >= zone_low and low <= zone_high)
        test_count = 0
        for idx, row in sub_df.iterrows():
            if row["high"] >= zone_low and row["low"] <= zone_high:
                test_count += 1

        # Strength scoring breakdown (0 - 100)
        reasons = []
        strength = 40.0

        if "SWING_HIGH" in c["types"] or "SWING_LOW" in c["types"]:
            strength += 25.0
            reasons.append("Previous swing level")

        if test_count >= 3:
            strength += 20.0
            reasons.append(f"Tested {test_count} times")

        if abs(price - vp.poc) <= zone_threshold:
            strength += 20.0
            reasons.append("High volume zone (POC)")

        # Check round number proximity (e.g. multiples of 50 or 100)
        if price > 50 and (round(price) % 50 == 0 or round(price) % 100 == 0):
            strength += 10.0
            reasons.append("Near round number")

        # Check DMA alignment
        if dma50 > 0 and abs(price - dma50) <= zone_threshold:
            strength += 15.0
            reasons.append("50 DMA nearby")

        if dma200 > 0 and abs(price - dma200) <= zone_threshold:
            strength += 15.0
            reasons.append("200 DMA nearby")

        strength = min(100.0, round(strength, 1))

        lvl_obj = SRLevel(
            level_type="RESISTANCE" if price > curr_price else "SUPPORT",
            label="",
            price=round(price, 2),
            zone_low=zone_low,
            zone_high=zone_high,
            distance_pct=round(dist_pct, 2),
            strength=strength,
            test_count=test_count,
            reasons=reasons,
        )

        if price > curr_price:
            resistances.append(lvl_obj)
        else:
            supports.append(lvl_obj)

    # Sort supports descending (closest support first)
    supports.sort(key=lambda x: x.price, reverse=True)
    # Sort resistances ascending (closest resistance first)
    resistances.sort(key=lambda x: x.price)

    # Assign labels S1, S2, S3 and R1, R2, R3
    for idx, s in enumerate(supports[:3]):
        s.label = f"S{idx+1}"
    for idx, r in enumerate(resistances[:3]):
        r.label = f"R{idx+1}"

    top_supports = supports[:3]
    top_resistances = resistances[:3]

    nearest_support = top_supports[0] if top_supports else None
    nearest_resistance = top_resistances[0] if top_resistances else None

    # Detect technical confluence tags
    confluence_tags = []
    if nearest_support and dma50 > 0 and abs(nearest_support.price - dma50) / curr_price <= 0.012:
        confluence_tags.append("50 DMA + Support Confluence")

    if nearest_support and dma200 > 0 and abs(nearest_support.price - dma200) / curr_price <= 0.012:
        confluence_tags.append("200 DMA + Support Confluence")

    if nearest_resistance and abs(nearest_resistance.distance_pct) <= 1.5:
        confluence_tags.append("Near Resistance")

    if nearest_support and abs(nearest_support.distance_pct) <= 1.5:
        confluence_tags.append("Near Support")

    return SRAnalysisResult(
        supports=top_supports,
        resistances=top_resistances,
        nearest_support=nearest_support,
        nearest_resistance=nearest_resistance,
        volume_profile=vp,
        confluence_tags=confluence_tags,
    )
