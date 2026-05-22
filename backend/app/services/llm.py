"""OpenAI helpers with safe fallback when not configured."""
from __future__ import annotations

from app.core.config import settings


async def chat_completion(system: str, user: str) -> str:
    if not settings.openai_configured:
        return (
            f"[Demo mode — set OPENAI_API_KEY] {user[:200]}: "
            "Consider reviewing support/resistance and position sizing before trading."
        )

    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage

    llm = ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=0.4,
    )
    response = await llm.ainvoke(
        [SystemMessage(content=system), HumanMessage(content=user)]
    )
    return str(response.content)
