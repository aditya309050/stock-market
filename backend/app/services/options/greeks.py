"""Black-Scholes Greeks and Implied Volatility (pure numpy, no scipy)."""
from __future__ import annotations

import math
import numpy as np


_SQRT_2PI = math.sqrt(2 * math.pi)
_INV_SQRT_2 = 1.0 / math.sqrt(2)


# ─── Normal distribution helpers ─────────────────────────────────────────────

def _norm_cdf(x: float) -> float:
    """Cumulative distribution function for the standard normal."""
    return 0.5 * (1.0 + math.erf(x * _INV_SQRT_2))


def _norm_pdf(x: float) -> float:
    """Probability density function for the standard normal."""
    return math.exp(-0.5 * x * x) / _SQRT_2PI


# ─── Black-Scholes core ───────────────────────────────────────────────────────

def _d1d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0.0, 0.0
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return d1, d2


def bs_call(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes call option price."""
    d1, d2 = _d1d2(S, K, T, r, sigma)
    return S * _norm_cdf(d1) - K * math.exp(-r * T) * _norm_cdf(d2)


def bs_put(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """Black-Scholes put option price."""
    d1, d2 = _d1d2(S, K, T, r, sigma)
    return K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)


# ─── Greeks ───────────────────────────────────────────────────────────────────

def bs_greeks(
    S: float,
    K: float,
    T: float,
    sigma: float,
    option_type: str = "CE",
    r: float = 0.065,
) -> dict[str, float]:
    """
    Compute Black-Scholes Greeks for a European option.

    Args:
        S: Spot price
        K: Strike price
        T: Time to expiry in years
        sigma: Annualised implied volatility (decimal, e.g. 0.15 for 15%)
        option_type: "CE" (call) or "PE" (put)
        r: Risk-free rate (default 6.5% — RBI repo rate)

    Returns:
        dict with delta, gamma, theta, vega, price
    """
    if T <= 0 or sigma <= 0:
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "price": 0.0}

    d1, d2 = _d1d2(S, K, T, r, sigma)
    sqrt_T = math.sqrt(T)
    nd1 = _norm_pdf(d1)
    exp_rT = math.exp(-r * T)

    gamma = nd1 / (S * sigma * sqrt_T)
    vega = S * nd1 * sqrt_T / 100  # per 1% change in IV

    if option_type == "CE":
        delta = _norm_cdf(d1)
        theta = (
            -(S * nd1 * sigma) / (2 * sqrt_T)
            - r * K * exp_rT * _norm_cdf(d2)
        ) / 365  # per day
        price = bs_call(S, K, T, r, sigma)
    else:
        delta = _norm_cdf(d1) - 1
        theta = (
            -(S * nd1 * sigma) / (2 * sqrt_T)
            + r * K * exp_rT * _norm_cdf(-d2)
        ) / 365
        price = bs_put(S, K, T, r, sigma)

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
        "price": round(price, 2),
    }


# ─── Implied Volatility (Newton-Raphson) ──────────────────────────────────────

def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    option_type: str = "CE",
    r: float = 0.065,
    max_iter: int = 100,
    tol: float = 1e-6,
) -> float:
    """
    Compute implied volatility using Newton-Raphson iteration.

    Returns IV as a decimal (e.g., 0.142 for 14.2%). Returns 0.0 on failure.
    """
    if T <= 0 or market_price <= 0 or S <= 0 or K <= 0:
        return 0.0

    sigma = 0.30  # initial guess

    for _ in range(max_iter):
        if option_type == "CE":
            price = bs_call(S, K, T, r, sigma)
        else:
            price = bs_put(S, K, T, r, sigma)

        d1, _ = _d1d2(S, K, T, r, sigma)
        vega_raw = S * _norm_pdf(d1) * math.sqrt(T)

        if vega_raw < 1e-10:
            break

        diff = price - market_price
        if abs(diff) < tol:
            break

        sigma -= diff / vega_raw
        if sigma <= 0:
            sigma = 1e-4

    return round(max(0.0, min(sigma, 5.0)), 5)  # cap at 500% IV


def days_to_expiry_fraction(expiry_str: str) -> float:
    """Convert 'DD-Mon-YYYY' expiry string to fraction of year remaining."""
    from datetime import datetime, timezone
    try:
        expiry = datetime.strptime(expiry_str, "%d-%b-%Y").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        days = max(0.0, (expiry - now).total_seconds() / 86400)
        return days / 365.0
    except Exception:
        return 1 / 365  # 1 day fallback
