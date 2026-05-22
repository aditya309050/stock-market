from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.models.user import User
from app.api import deps
from app.services.llm import chat_completion

router = APIRouter()

class ChatMessage(BaseModel):
    message: str

@router.post("/chat")
async def copilot_chat(
    msg: ChatMessage,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    system = (
        "You are an AI trading copilot. Be concise, practical, and risk-aware. "
        "Never guarantee returns. Mention key risks when suggesting trades."
    )
    user = f"Trader question: {msg.message}"
    reply = await chat_completion(system, user)
    return {"reply": reply}
