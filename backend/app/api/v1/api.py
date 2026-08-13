from fastapi import APIRouter
from .endpoints import (
    auth,
    watchlist,
    nse_screener,
    ai,
    analytics,
    dma_screener,
    sector_screener,
    golden_cross,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(nse_screener.router, prefix="/nse", tags=["nse-screener"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(sector_screener.router, prefix="/sector-screener", tags=["sector-screener"])
api_router.include_router(dma_screener.router, prefix="/dma-screener", tags=["dma-screener"])
api_router.include_router(golden_cross.router, prefix="/golden-cross", tags=["golden-cross"])

