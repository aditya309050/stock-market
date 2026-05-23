"""AI Probability Scoring Engine for 50 DMA Setups."""
from typing import Any
import pandas as pd

def score_50dma_breakout(df: pd.DataFrame, signals: dict[str, Any]) -> dict[str, Any]:
    """
    Scores the probability of a stock crossing or bouncing from the 50 DMA.
    Returns a score out of 100 and a high/medium/low probability classification.
    """
    score = 0
    max_score = 100
    
    if len(df) < 5:
        return {"probability_score": 0, "probability_class": "Low", "ai_analysis": "Not enough data"}

    last = df.iloc[-1]
    
    # 1. Volume Increase (0-20 points)
    avg_vol = df["volume"].iloc[-21:-1].mean()
    vol_spike = (float(last["volume"]) / avg_vol) if avg_vol > 0 else 1
    if vol_spike > 2.0:
        score += 20
    elif vol_spike > 1.5:
        score += 15
    elif vol_spike > 1.1:
        score += 10
        
    # 2. RSI Trend (0-20 points)
    rsi_val = float(signals.get("rsi") or 50)
    if 50 <= rsi_val <= 70:
        score += 20
    elif rsi_val > 70:
        score += 10 # Overbought, but momentum is there
    elif rsi_val > 40:
        score += 5
        
    # 3. MACD Crossover (0-20 points)
    if signals.get("macd_bullish_cross"):
        score += 20
    elif float(signals.get("macd") or 0) > float(signals.get("macd_signal") or 0):
        score += 10
        
    # 4. Candle Strength (0-15 points)
    # Strong body: Close > Open, and body is large part of candle
    body_size = abs(float(last["close"]) - float(last["open"]))
    total_size = float(last["high"]) - float(last["low"])
    if total_size > 0:
        body_ratio = body_size / total_size
        if float(last["close"]) > float(last["open"]) and body_ratio > 0.6:
            score += 15
        elif float(last["close"]) > float(last["open"]):
            score += 5
            
    # 5. Distance to 50 DMA (0-15 points)
    cmp = float(last["close"])
    sma50 = float(last.get("sma50", cmp))
    distance_pct = abs(cmp - sma50) / sma50 * 100
    if distance_pct <= 1.0:
        score += 15
    elif distance_pct <= 2.0:
        score += 10
    elif distance_pct <= 5.0:
        score += 5
        
    # 6. Breakout Structure / Golden Trend (0-10 points)
    if signals.get("above_ema200") and sma50 > float(last.get("sma200", 0)):
        score += 10
        
    # Classification
    if score >= 75:
        prob_class = "High"
    elif score >= 50:
        prob_class = "Medium"
    else:
        prob_class = "Low"
        
    # AI Analysis String
    analysis = f"Stock is currently trading at ₹{cmp:.2f}, which is {distance_pct:.1f}% away from its 50 DMA. "
    if vol_spike > 1.5:
        analysis += "There is a notable surge in volume indicating strong participation. "
    if rsi_val > 50:
        analysis += "RSI is bullish and momentum is improving. "
    if prob_class == "High":
        analysis += "Probability of a successful setup or breakout is HIGH."
    elif prob_class == "Medium":
        analysis += "Probability of a successful setup is MEDIUM. Watch for confirmation."
    else:
        analysis += "Probability of a successful setup is LOW. Risk is elevated."

    return {
        "probability_score": score,
        "probability_class": prob_class,
        "ai_analysis": analysis,
        "distance_from_50dma_pct": round(distance_pct, 2),
        "volume_spike": round(vol_spike, 2),
    }
