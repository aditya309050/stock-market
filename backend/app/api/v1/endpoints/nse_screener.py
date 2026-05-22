import csv
import io
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.models.scan_run import ScanRun
from app.schemas.nse_screener import (
    NSEMarketOverview,
    NSEScanFilters,
    NSEScanRequest,
    NSEScanResponse,
    NSESymbolInfo,
)
from app.services.llm import chat_completion
from app.services.nse.client import nse_client
from app.services.nse.scanner import nse_scanner

router = APIRouter()


@router.get("/symbols")
async def list_nse_symbols(
    index: str = Query("NIFTY 500"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    symbols = await nse_client.get_index_symbols(index)
    return {"index": index, "count": len(symbols), "symbols": symbols}


@router.get("/market-overview", response_model=NSEMarketOverview)
async def market_overview(
    index: str = Query("NIFTY 500"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    movers = await nse_client.get_market_movers(index)
    return NSEMarketOverview(
        gainers=[NSESymbolInfo(**g) for g in movers["gainers"]],
        losers=[NSESymbolInfo(**l) for l in movers["losers"]],
    )


@router.get("/quote/{symbol}")
async def get_quote(
    symbol: str,
    timeframe: str = Query("1d"),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    from app.services.indicators.engine import latest_signals

    df = await nse_client.fetch_ohlc(symbol, timeframe, limit=120)
    if df.empty:
        return {"symbol": symbol, "error": "No data"}
    return {"symbol": symbol.upper(), "timeframe": timeframe, "signals": latest_signals(df)}


@router.post("/scan", response_model=NSEScanResponse)
async def run_nse_scan(
    request: NSEScanRequest,
    save: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    response = await nse_scanner.scan(request)

    if save:
        run = ScanRun(
            owner_id=current_user.id,
            index_name=request.filters.index,
            filters_json=nse_scanner.filters_to_json(request.filters),
            scanned_count=response.scanned,
            matched_count=response.matched,
            results_json=json.dumps([r.model_dump() for r in response.results]),
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)
        response.scan_id = run.id

    return response


@router.post("/smart-scan", response_model=NSEScanResponse)
async def smart_scan(
    index: str = Query("NIFTY 500"),
    symbol: str | None = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """One-click scan: all indicators + AI swing summary (no manual filters)."""
    request = NSEScanRequest(
        filters=NSEScanFilters(auto=True, index=index),
        symbols=[symbol.upper()] if symbol else None,
    )
    response = await nse_scanner.scan(request)
    response = await _attach_ai_insights(response)
    response.summary = await _market_summary(response)

    run = ScanRun(
        owner_id=current_user.id,
        index_name=index,
        filters_json='{"auto": true}',
        scanned_count=response.scanned,
        matched_count=response.matched,
        results_json=json.dumps([r.model_dump() for r in response.results]),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    response.scan_id = run.id
    return response


async def _attach_ai_insights(response: NSEScanResponse) -> NSEScanResponse:
    """Per-stock swing notes for top picks."""
    top = response.results[:8]
    if not top:
        return response

    picks = [
        {
            "symbol": r.symbol,
            "score": r.ai_score,
            "signal": r.swing_signal,
            "tags": r.swing_tags,
            "rsi": r.signals_by_tf.get("1d", {}).get("rsi"),
        }
        for r in top
    ]
    system = (
        "You are an NSE swing-trading coach for beginners. "
        "For each stock give ONE short sentence (max 20 words) explaining the swing setup. "
        "Return valid JSON only: {\"notes\": {\"SYMBOL\": \"sentence\", ...}}"
    )
    user = f"Stocks: {json.dumps(picks)}"
    try:
        raw = await chat_completion(system, user)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        data = json.loads(raw[start:end]) if start >= 0 else {}
        notes: dict = data.get("notes", {})
        for r in response.results:
            if r.symbol in notes:
                r.ai_note = notes[r.symbol]
    except Exception:
        pass
    return response


async def _market_summary(response: NSEScanResponse) -> str:
    top = response.results[:5]
    if not top:
        return (
            f"Scanned {response.scanned} stocks. No strong swing setups found right now. "
            "Try again later or pick a different index."
        )
    picks = [
        {"symbol": r.symbol, "signal": r.swing_signal, "score": r.ai_score, "tags": r.swing_tags[:3]}
        for r in top
    ]
    system = (
        "You are an NSE swing-trading analyst writing for a beginner. "
        "In 3–4 short bullet points: market mood, top swing picks, what to watch, risk reminder. "
        "Plain English. No jargon. No guaranteed returns."
    )
    user = (
        f"Scanned {response.scanned} stocks, {response.matched} had swing potential. "
        f"Top picks: {json.dumps(picks)}"
    )
    try:
        return await chat_completion(system, user)
    except Exception:
        names = ", ".join(r.symbol for r in top[:5])
        return (
            f"Found {response.matched} swing setups from {response.scanned} stocks. "
            f"Top picks: {names}. Always use a stop-loss."
        )


@router.get("/scan/history")
async def scan_history(
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    from sqlalchemy import select

    q = (
        select(ScanRun)
        .where(ScanRun.owner_id == current_user.id)
        .order_by(ScanRun.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat(),
            "index": r.index_name,
            "scanned": r.scanned_count,
            "matched": r.matched_count,
        }
        for r in rows
    ]


@router.get("/scan/{scan_id}/export")
async def export_scan_csv(
    scan_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    from sqlalchemy import select

    q = select(ScanRun).where(
        ScanRun.id == scan_id, ScanRun.owner_id == current_user.id
    )
    run = (await db.execute(q)).scalars().first()
    if not run:
        from fastapi import HTTPException
        raise HTTPException(404, "Scan not found")

    results = json.loads(run.results_json)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["symbol", "swing_signal", "ai_score", "tags", "rsi_1d", "ai_note"]
    )
    for r in results:
        sig1d = r.get("signals_by_tf", {}).get("1d", {})
        writer.writerow(
            [
                r.get("symbol"),
                r.get("swing_signal"),
                r.get("ai_score"),
                ", ".join(r.get("swing_tags", [])),
                sig1d.get("rsi"),
                r.get("ai_note"),
            ]
        )
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=scan_{scan_id}.csv"},
    )


@router.post("/ai-predict")
async def ai_predict_scan(
    request: NSEScanRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Legacy alias — same as smart-scan body."""
    request.filters.auto = True
    scan = await nse_scanner.scan(request)
    scan = await _attach_ai_insights(scan)
    summary = await _market_summary(scan)
    return {"scan": scan, "prediction": summary}
