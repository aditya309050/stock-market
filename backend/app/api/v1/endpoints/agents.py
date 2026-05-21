from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.models.user import User
from app.api import deps
from app.agents.graph import run_agent_pipeline

router = APIRouter()

class AgentAnalysisRequest(BaseModel):
    symbol: str
    price_data: list[float] | None = None
    sentiment: float = 0.0
    account_balance: float = 100000.0
    risk_tolerance: str = "medium"

@router.post("/analyze")
async def run_autonomous_analysis(
    request: AgentAnalysisRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Triggers the multi-agent autonomous pipeline (Analyst -> Risk -> Strategy).
    """
    try:
        # In production, we might dispatch this via Celery/Kafka for async processing
        result = await run_agent_pipeline(
            symbol=request.symbol,
            price_data=request.price_data,
            sentiment=request.sentiment,
            account_balance=request.account_balance,
            risk_tolerance=request.risk_tolerance,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
