"""
Vector memory abstraction for AI agent long-term recall.
Uses pgvector within PostgreSQL for consolidated infrastructure.
Falls back to an in-memory dictionary when pgvector is unavailable.
"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class VectorMemory:
    """
    Lightweight vector memory store.
    In production, this wraps pgvector or a dedicated service (Pinecone / Chroma).
    For scaffolding, we use an in-memory list with naive cosine-similarity stub.
    """

    def __init__(self):
        self._store: List[Dict[str, Any]] = []

    async def add(self, text: str, metadata: dict | None = None) -> None:
        """Store a text chunk with optional metadata."""
        entry = {
            "text": text,
            "metadata": metadata or {},
            # In production: embedding = await openai.embed(text)
            "embedding": None,
        }
        self._store.append(entry)
        logger.debug(f"Memory stored ({len(self._store)} total): {text[:60]}…")

    async def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve the top-k most relevant memories for a query.
        Stub: returns the most recent entries (no real similarity search).
        """
        # In production: embed the query → cosine similarity against pgvector
        return self._store[-top_k:]

    async def clear(self) -> None:
        self._store.clear()


# Singleton used by all agents
agent_memory = VectorMemory()
