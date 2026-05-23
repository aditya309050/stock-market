"""Technical indicator + breakout detection engine (pandas)."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(period).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = ema(close, fast)
    ema_slow = ema(close, slow)
    line = ema_fast - ema_slow
    sig = ema(line, signal)
    hist = line - sig
    return line, sig, hist


def bollinger(close: pd.Series, period: int = 20, std: float = 2.0):
    mid = sma(close, period)
    dev = close.rolling(period).std()
    return mid + std * dev, mid, mid - std * dev


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat(
        [
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period).mean()


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = np.where((plus_dm > minus_dm) & (plus_dm > 0), plus_dm, 0.0)
    minus_dm = np.where((minus_dm > plus_dm) & (minus_dm > 0), minus_dm, 0.0)
    atr_val = atr(df, period)
    plus_di = 100 * pd.Series(plus_dm, index=df.index).rolling(period).mean() / atr_val
    minus_di = 100 * pd.Series(minus_dm, index=df.index).rolling(period).mean() / atr_val
    dx = (abs(plus_di - minus_di) / (plus_di + minus_di).replace(0, np.nan)) * 100
    return dx.rolling(period).mean()


def vwap(df: pd.DataFrame) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3
    return (tp * df["volume"]).cumsum() / df["volume"].cumsum().replace(0, np.nan)


def supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> pd.Series:
    hl2 = (df["high"] + df["low"]) / 2
    atr_val = atr(df, period)
    upper = hl2 + multiplier * atr_val
    lower = hl2 - multiplier * atr_val
    st = pd.Series(index=df.index, dtype=float)
    direction = pd.Series(1, index=df.index)
    for i in range(1, len(df)):
        if df["close"].iloc[i] > upper.iloc[i - 1]:
            direction.iloc[i] = 1
        elif df["close"].iloc[i] < lower.iloc[i - 1]:
            direction.iloc[i] = -1
        else:
            direction.iloc[i] = direction.iloc[i - 1]
        st.iloc[i] = lower.iloc[i] if direction.iloc[i] == 1 else upper.iloc[i]
    return st


def stochastic_rsi(close: pd.Series, period: int = 14, k: int = 3, d: int = 3):
    r = rsi(close, period)
    min_r = r.rolling(period).min()
    max_r = r.rolling(period).max()
    stoch = (r - min_r) / (max_r - min_r).replace(0, np.nan) * 100
    k_line = stoch.rolling(k).mean()
    d_line = k_line.rolling(d).mean()
    return k_line, d_line


def swing_levels(df: pd.DataFrame, window: int = 5) -> tuple[float, float]:
    highs = df["high"].rolling(window * 2 + 1, center=True).max()
    lows = df["low"].rolling(window * 2 + 1, center=True).min()
    swing_high = df.loc[df["high"] == highs, "high"].dropna()
    swing_low = df.loc[df["low"] == lows, "low"].dropna()
    sh = float(swing_high.iloc[-2]) if len(swing_high) >= 2 else float(df["high"].max())
    sl = float(swing_low.iloc[-2]) if len(swing_low) >= 2 else float(df["low"].min())
    return sh, sl


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) < 30:
        return df
    out = df.copy()
    out["rsi"] = rsi(out["close"])
    macd_line, macd_sig, macd_hist = macd(out["close"])
    out["macd"] = macd_line
    out["macd_signal"] = macd_sig
    out["macd_hist"] = macd_hist
    out["ema20"] = ema(out["close"], 20)
    out["ema50"] = ema(out["close"], 50)
    out["ema200"] = ema(out["close"], 200)
    out["sma20"] = sma(out["close"], 20)
    out["sma50"] = sma(out["close"], 50)
    out["sma200"] = sma(out["close"], 200)
    out["vwap"] = vwap(out)
    bb_u, bb_m, bb_l = bollinger(out["close"])
    out["bb_upper"], out["bb_mid"], out["bb_lower"] = bb_u, bb_m, bb_l
    out["supertrend"] = supertrend(out)
    out["adx"] = adx(out)
    out["atr"] = atr(out)
    out["stoch_rsi_k"], out["stoch_rsi_d"] = stochastic_rsi(out["close"])
    out["vol_sma20"] = out["volume"].rolling(20).mean()
    return out


def detect_breakouts(df: pd.DataFrame, window: int = 5) -> dict[str, bool]:
    if len(df) < window + 5:
        return {k: False for k in (
            "swing_high_breakout", "swing_low_breakout", "volume_breakout",
            "consolidation_breakout", "resistance_breakout",
        )}
    last = df.iloc[-1]
    prev = df.iloc[-2]
    swing_high, swing_low = swing_levels(df.iloc[:-1], window)
    avg_vol = df["volume"].iloc[-21:-1].mean()
    recent_range = df["high"].iloc[-10:-1].max() - df["low"].iloc[-10:-1].min()
    atr_val = float(df["atr"].iloc[-1]) if "atr" in df else recent_range

    return {
        "swing_high_breakout": float(last["close"]) > swing_high and float(prev["close"]) <= swing_high,
        "swing_low_breakout": float(last["close"]) < swing_low and float(prev["close"]) >= swing_low,
        "volume_breakout": float(last["volume"]) > avg_vol * 1.5 if avg_vol else False,
        "consolidation_breakout": recent_range < atr_val * 0.8 and float(last["close"]) > df["high"].iloc[-10:-1].max(),
        "resistance_breakout": float(last["close"]) > swing_high,
    }


def candle_patterns(df: pd.DataFrame) -> dict[str, bool]:
    if len(df) < 3:
        return {"bullish_engulfing": False, "bearish_engulfing": False, "gap_up": False, "gap_down": False}
    a, b = df.iloc[-2], df.iloc[-1]
    gap_up = float(b["low"]) > float(a["high"])
    gap_down = float(b["high"]) < float(a["low"])
    bullish = (
        float(a["close"]) < float(a["open"])
        and float(b["close"]) > float(b["open"])
        and float(b["close"]) > float(a["open"])
        and float(b["open"]) < float(a["close"])
    )
    bearish = (
        float(a["close"]) > float(a["open"])
        and float(b["close"]) < float(b["open"])
        and float(b["close"]) < float(a["open"])
        and float(b["open"]) > float(a["close"])
    )
    return {"bullish_engulfing": bullish, "bearish_engulfing": bearish, "gap_up": gap_up, "gap_down": gap_down}


def latest_signals(df: pd.DataFrame) -> dict[str, Any]:
    df = enrich_dataframe(df)
    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last
    breakouts = detect_breakouts(df)
    patterns = candle_patterns(df)
    macd_bull = float(last.get("macd", 0)) > float(last.get("macd_signal", 0)) and float(
        prev.get("macd", 0)
    ) <= float(prev.get("macd_signal", 0))
    return {
        "price": round(float(last["close"]), 2),
        "rsi": round(float(last["rsi"]), 2) if pd.notna(last.get("rsi")) else None,
        "macd": round(float(last["macd"]), 4) if pd.notna(last.get("macd")) else None,
        "macd_bullish_cross": macd_bull,
        "sma50": round(float(last.get("sma50")), 2) if pd.notna(last.get("sma50")) else None,
        "sma200": round(float(last.get("sma200")), 2) if pd.notna(last.get("sma200")) else None,
        "above_ema20": float(last["close"]) > float(last.get("ema20", last["close"])),
        "above_ema50": float(last["close"]) > float(last.get("ema50", last["close"])),
        "above_ema200": float(last["close"]) > float(last.get("ema200", last["close"])),
        "above_vwap": float(last["close"]) > float(last.get("vwap", last["close"])),
        "supertrend_bull": float(last["close"]) > float(last.get("supertrend", 0)),
        "adx": round(float(last["adx"]), 2) if pd.notna(last.get("adx")) else None,
        "atr": round(float(last["atr"]), 2) if pd.notna(last.get("atr")) else None,
        "stoch_rsi_k": round(float(last["stoch_rsi_k"]), 2) if pd.notna(last.get("stoch_rsi_k")) else None,
        "high_volume": float(last["volume"]) > float(last.get("vol_sma20", 0)) * 1.3,
        **breakouts,
        **patterns,
    }
