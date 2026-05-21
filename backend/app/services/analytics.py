from app.schemas.analytics import AnalyticsDashboardResponse

class AnalyticsService:
    async def get_dashboard_data(self, owner_id: int) -> AnalyticsDashboardResponse:
        # Mock analytics aggregation
        return AnalyticsDashboardResponse(
            total_portfolio_value=125000.50,
            daily_pnl=450.20,
            active_strategies_count=3,
            triggered_alerts_count=5,
            top_performers=[
                {"symbol": "NVDA", "return": 15.2},
                {"symbol": "MSFT", "return": 5.4}
            ]
        )

analytics_service = AnalyticsService()
