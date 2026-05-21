from typing import Any
from fastapi import APIRouter, Depends
from app.workers.tasks import send_alert
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.post("/test")
async def test_alert(
    message: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Test background task for sending alerts"""
    task = send_alert.delay(current_user.id, message)
    return {"msg": "Alert task dispatched", "task_id": task.id}
