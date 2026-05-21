"""
Kafka Producer/Consumer abstraction for the event-driven trading pipeline.
Wraps confluent-kafka to provide typed, async-friendly event publishing and consumption.
"""
import json
import logging
from typing import Optional, Callable
from app.core.config import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
#  Lazy-loaded Kafka clients (import-safe if
#  confluent-kafka is not installed yet)
# ──────────────────────────────────────────────
_producer = None
_consumers: dict = {}


def _get_producer():
    global _producer
    if _producer is None:
        try:
            from confluent_kafka import Producer
            _producer = Producer({
                "bootstrap.servers": getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
                "client.id": "trading-api",
            })
        except ImportError:
            logger.warning("confluent-kafka not installed – Kafka producer unavailable")
    return _producer


def publish_event(topic: str, key: str, payload: dict) -> None:
    """Fire-and-forget publish of a JSON event to a Kafka topic."""
    producer = _get_producer()
    if producer is None:
        logger.warning(f"Kafka unavailable – dropping event on {topic}")
        return
    producer.produce(
        topic=topic,
        key=key.encode("utf-8"),
        value=json.dumps(payload).encode("utf-8"),
        callback=_delivery_report,
    )
    producer.flush(timeout=5)


def _delivery_report(err, msg):
    if err:
        logger.error(f"Kafka delivery failed: {err}")
    else:
        logger.debug(f"Event delivered to {msg.topic()} [{msg.partition()}]")


def create_consumer(topic: str, group_id: str):
    """Create a Kafka consumer for a specific topic."""
    try:
        from confluent_kafka import Consumer
        consumer = Consumer({
            "bootstrap.servers": getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            "group.id": group_id,
            "auto.offset.reset": "latest",
        })
        consumer.subscribe([topic])
        return consumer
    except ImportError:
        logger.warning("confluent-kafka not installed – consumer unavailable")
        return None
