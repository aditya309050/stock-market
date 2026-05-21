"""
Social / Copy Trading service — manages follower relationships
and distributes trade execution events to subscribers.
"""
from typing import Dict, Any
from app.events.kafka_client import publish_event


class SocialService:
    async def follow_strategy(self, follower_id: int, published_strategy_id: int, allocation_pct: float = 10.0) -> Dict[str, Any]:
        """Subscribe a user to a published strategy for copy trading."""
        return {
            "status": "subscribed",
            "follower_id": follower_id,
            "published_strategy_id": published_strategy_id,
            "allocation_pct": allocation_pct,
        }

    async def unfollow_strategy(self, follower_id: int, published_strategy_id: int) -> Dict[str, Any]:
        """Unsubscribe a user from copy trading."""
        return {
            "status": "unsubscribed",
            "follower_id": follower_id,
            "published_strategy_id": published_strategy_id,
        }

    async def distribute_signal(self, published_strategy_id: int, signal: Dict[str, Any]) -> None:
        """
        When a strategy author executes a trade, push the signal
        to Kafka so all followers can replicate it.
        """
        publish_event(
            topic="trade.signals",
            key=f"copy_{published_strategy_id}",
            payload={
                "published_strategy_id": published_strategy_id,
                "signal": signal,
                "type": "copy_trade",
            },
        )


social_service = SocialService()
