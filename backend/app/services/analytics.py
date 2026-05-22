from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.watchlist import watchlist_repo
from app.schemas.analytics import AnalyticsDashboardResponse
from app.services.nse.client import nse_client


class AnalyticsService:
    async def get_dashboard_data(
        self, db: AsyncSession, owner_id: int
    ) -> AnalyticsDashboardResponse:
        watchlist = await watchlist_repo.get_by_owner(db, owner_id=owner_id)
        symbols = [w.symbol for w in watchlist[:8]] or ["RELIANCE", "TCS", "INFY"]

        movers = await nse_client.get_market_movers("NIFTY 50")
        gainers = movers.get("gainers", [])
        losers = movers.get("losers", [])

        top_performers = [
            {"symbol": g["symbol"], "return": g["change_pct"]} for g in gainers[:5]
        ]
        if not top_performers:
            top_performers = [{"symbol": s, "return": 0.0} for s in symbols[:3]]

        total_change = sum(g.get("change_pct", 0) for g in gainers[:5])
        daily_pnl = round(total_change * 1000, 2)  # illustrative from index movers

        return AnalyticsDashboardResponse(
            total_portfolio_value=0.0,
            daily_pnl=daily_pnl,
            active_strategies_count=len(watchlist),
            triggered_alerts_count=0,
            top_performers=top_performers,
        )


analytics_service = AnalyticsService()
