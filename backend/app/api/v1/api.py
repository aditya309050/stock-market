from fastapi import APIRouter
from .endpoints import (
    auth,
    watchlist,
    nse_screener,
    ai,
    analytics,
    copilot,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(nse_screener.router, prefix="/nse", tags=["nse-screener"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
