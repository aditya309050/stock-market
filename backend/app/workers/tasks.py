import time
from app.core.celery_app import celery_app

@celery_app.task(name="app.workers.tasks.scan_stocks")
def scan_stocks():
    """Sample task to scan stocks in the background"""
    time.sleep(2)
    print("Stock scanning completed successfully")
    return "Scanned 500 stocks"

@celery_app.task(name="app.workers.tasks.send_alert")
def send_alert(user_id: int, message: str):
    """Sample task to send alerts"""
    time.sleep(1)
    print(f"Alert sent to user {user_id}: {message}")
    return True

@celery_app.task(name="app.workers.tasks.ai_analysis_job")
def ai_analysis_job(symbol: str):
    """Sample long running AI job"""
    time.sleep(5)
    print(f"AI Analysis completed for {symbol}")
    return {"symbol": symbol, "status": "analyzed"}

@celery_app.task(name="app.workers.tasks.ingest_historical_candles")
def ingest_historical_candles(symbol: str, timeframe: str):
    """Background task to fetch and store historical data from broker"""
    time.sleep(3)
    print(f"Historical candles ingested for {symbol} ({timeframe})")
    return True

@celery_app.task(name="app.workers.tasks.run_execution_loop")
def run_execution_loop():
    """Periodic task to evaluate active strategies and execute trades"""
    print("Evaluating active strategies...")
    return True

@celery_app.task(name="app.workers.tasks.generate_ai_summary")
def generate_ai_summary():
    """Daily task to generate and broadcast AI market summary"""
    print("Generating AI daily summary...")
    return True
