from pydantic import BaseModel
from typing import List, Dict, Any

class AnalyticsDashboardResponse(BaseModel):
    total_portfolio_value: float
    daily_pnl: float
    active_strategies_count: int
    triggered_alerts_count: int
    top_performers: List[Dict[str, Any]]
