from fastapi import APIRouter
from .endpoints import (
    auth, watchlist, screener, alerts, ai, 
    strategies, backtest, portfolios, candles, analytics, advanced_alerts,
    copilot, subscriptions, agents, marketplace, social, paper
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(screener.router, prefix="/screener", tags=["screener"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(backtest.router, prefix="/backtest", tags=["backtest"])
api_router.include_router(portfolios.router, prefix="/portfolios", tags=["portfolios"])
api_router.include_router(candles.router, prefix="/candles", tags=["candles"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(advanced_alerts.router, prefix="/advanced_alerts", tags=["advanced_alerts"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])
api_router.include_router(social.router, prefix="/social", tags=["social"])
api_router.include_router(paper.router, prefix="/paper", tags=["paper"])
