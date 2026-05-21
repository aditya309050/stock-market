from typing import Dict, Type
from app.brokers.base import BaseBroker
from app.brokers.mock_broker import MockBroker

class BrokerManager:
    def __init__(self):
        self._brokers: Dict[str, BaseBroker] = {}

    def register_broker(self, name: str, broker_instance: BaseBroker):
        self._brokers[name] = broker_instance

    def get_broker(self, name: str) -> BaseBroker:
        broker = self._brokers.get(name)
        if not broker:
            raise ValueError(f"Broker {name} not registered")
        return broker

broker_manager = BrokerManager()

# Register the default mock broker
broker_manager.register_broker("mock", MockBroker())
