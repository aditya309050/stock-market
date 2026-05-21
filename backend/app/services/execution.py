from app.brokers.manager import broker_manager

class ExecutionEngine:
    async def execute_trade(self, broker_name: str, symbol: str, qty: float, side: str):
        """
        Live execution engine that communicates with the broker integration layer.
        """
        broker = broker_manager.get_broker(broker_name)
        result = await broker.submit_order(symbol, qty, side)
        return result

execution_engine = ExecutionEngine()
