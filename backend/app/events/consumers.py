"""
Background Kafka consumers that can be run as standalone workers
or launched from Celery beat tasks.
"""
import json
import logging
from app.events.kafka_client import create_consumer

logger = logging.getLogger(__name__)


def consume_market_ticks(handler_fn=None, max_messages: int = 100):
    """Poll the market.ticks topic and dispatch each tick to handler_fn."""
    consumer = create_consumer("market.ticks", "tick-processor-group")
    if consumer is None:
        logger.warning("Kafka consumer not available – skipping tick consumption")
        return

    try:
        count = 0
        while count < max_messages:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                logger.error(f"Consumer error: {msg.error()}")
                continue

            payload = json.loads(msg.value().decode("utf-8"))
            logger.info(f"Tick received: {payload.get('symbol')} @ {payload.get('price')}")

            if handler_fn:
                handler_fn(payload)
            count += 1
    finally:
        consumer.close()


def consume_trade_signals(handler_fn=None, max_messages: int = 100):
    """Poll the trade.signals topic and forward to execution engine."""
    consumer = create_consumer("trade.signals", "signal-executor-group")
    if consumer is None:
        logger.warning("Kafka consumer not available – skipping signal consumption")
        return

    try:
        count = 0
        while count < max_messages:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                logger.error(f"Consumer error: {msg.error()}")
                continue

            payload = json.loads(msg.value().decode("utf-8"))
            logger.info(f"Signal received: {payload.get('action')} {payload.get('symbol')}")

            if handler_fn:
                handler_fn(payload)
            count += 1
    finally:
        consumer.close()
