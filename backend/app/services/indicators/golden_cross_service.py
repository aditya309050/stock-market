from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from app.schemas.golden_cross import GoldenCrossItem, GoldenCrossRadarResponse
from app.services.dhan.dhan_client import dhan_client
from app.services.indicators.dma_engine import calculate_dma_metrics, DMAMetrics
from app.services.nse.client import nse_client


class GoldenCrossService:
    def __init__(self) -> None:
        self._cache: GoldenCrossRadarResponse | None = None
        self._cache_time: datetime | None = None

    async def scan_universe(
        self,
        custom_symbols: list[str] | None = None,
        index: str = "NIFTY 500",
        is_intraday: bool = False,
    ) -> GoldenCrossRadarResponse:
        """
        Scans all eligible stocks from specified index or full Dhan Instrument Master for 50/200 DMA signals.
        Calculates exact CROSSED TODAY, RECENT CROSS, ESTABLISHED CROSS, and NEAR CROSS events.
        """
        scrip_list = []
        if custom_symbols:
            scrip_list = [{"symbol": s, "company_name": s} for s in custom_symbols]
        elif index.upper() in ["NSE ALL", "ALL"]:
            try:
                scrip_list = await dhan_client.fetch_scrip_master()
            except Exception:
                pass
        else:
            try:
                symbols = await nse_client.get_index_symbols(index)
                if len(symbols) > 25:
                    scrip_list = [{"symbol": s, "company_name": s} for s in symbols]
                else:
                    scrip_list = await dhan_client.fetch_scrip_master()
            except Exception:
                pass

        if not scrip_list:
            try:
                scrip_list = await dhan_client.fetch_scrip_master()
            except Exception:
                symbols = await nse_client.get_index_symbols("NIFTY 500")
                scrip_list = [{"symbol": s, "company_name": s} for s in symbols]


        sem = asyncio.Semaphore(35)

        async def process_one(scrip: dict[str, Any]) -> GoldenCrossItem | None:
            sym = scrip.get("symbol", "")
            if not sym:
                return None
            async with sem:
                try:
                    df = await dhan_client.fetch_historical_daily(sym, limit=250)
                    if df.empty or len(df) < 50:
                        return None

                    metrics: DMAMetrics | None = calculate_dma_metrics(
                        df, symbol=sym, is_intraday=is_intraday
                    )
                    if not metrics:
                        return None

                    # Filter for interesting setups: Crossed today, recent cross, near cross, or score >= 50
                    if not (
                        metrics.is_golden_cross
                        or metrics.is_recent_cross
                        or metrics.is_near_cross
                        or metrics.score >= 50.0
                    ):
                        return None

                    return GoldenCrossItem(
                        symbol=sym,
                        company_name=scrip.get("company_name", sym),
                        last_price=metrics.last_price,
                        dma50=metrics.dma50,
                        dma200=metrics.dma200,
                        prev_dma50=metrics.prev_dma50,
                        prev_dma200=metrics.prev_dma200,
                        gap_pct=metrics.gap_pct,
                        status=metrics.status,
                        cross_category=metrics.cross_category,
                        is_golden_cross=metrics.is_golden_cross,
                        is_recent_cross=metrics.is_recent_cross,
                        is_established_cross=metrics.is_established_cross,
                        is_near_cross=metrics.is_near_cross,
                        is_above_200=metrics.is_above_200,
                        is_above_50=metrics.is_above_50,
                        score=metrics.score,
                        timestamp=datetime.now(timezone.utc),
                    )
                except Exception:
                    return None

        # Scan full pool (up to 1000 stocks per pass)
        target_pool = scrip_list[:1000]

        tasks = [process_one(s) for s in target_pool]
        raw_results = await asyncio.gather(*tasks)
        valid_items = [r for r in raw_results if r is not None]

        # Sort Priority: CROSSED TODAY > RECENT CROSS > NEAR CROSS > ESTABLISHED CROSS
        def sort_priority(item: GoldenCrossItem) -> int:
            if item.is_golden_cross:
                return 1
            if item.is_recent_cross:
                return 2
            if item.is_near_cross:
                return 3
            if item.is_established_cross:
                return 4
            return 5

        valid_items.sort(key=lambda x: (sort_priority(x), -x.score, x.gap_pct))

        golden_count = sum(1 for item in valid_items if item.is_golden_cross)
        near_count = sum(1 for item in valid_items if item.is_near_cross)
        provisional_count = sum(1 for item in valid_items if item.status == "provisional")

        response = GoldenCrossRadarResponse(
            total_scanned=len(target_pool),
            golden_cross_count=golden_count,
            near_cross_count=near_count,
            provisional_count=provisional_count,
            results=valid_items,
        )

        self._cache = response
        self._cache_time = datetime.now(timezone.utc)

        return response


golden_cross_service = GoldenCrossService()
