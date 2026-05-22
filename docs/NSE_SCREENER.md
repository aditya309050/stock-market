# NSE Screener Pro — Lean architecture

## Active stack

```
backend/app/
├── api/v1/
│   ├── api.py
│   └── endpoints/
│       ├── auth.py
│       ├── watchlist.py
│       ├── nse_screener.py   # scan, quote, CSV, AI
│       ├── ai.py
│       ├── analytics.py
│       └── copilot.py
├── services/
│   ├── nse/client.py         # NSE + Yahoo OHLC
│   ├── nse/scanner.py
│   ├── indicators/engine.py
│   ├── auth.py
│   ├── watchlist.py
│   ├── analytics.py
│   ├── ai.py
│   └── llm.py
├── models/                   # User, Watchlist, ScanRun
└── main.py

frontend/src/
├── app/screener/             # Main UI
├── app/dashboard/
├── app/chat/
├── hooks/nse-queries.ts
└── lib/api.ts
```

## Docker (minimal)

- `postgres:15` + `api` only (no Redis, Kafka, Celery)

## API routes

| Prefix | Purpose |
|--------|---------|
| `/auth` | Login, register |
| `/nse` | Screener, market overview, AI predict |
| `/watchlist` | Favorites |
| `/analytics` | Dashboard movers |
| `/ai` | Per-symbol AI tip |
| `/copilot` | Chat |

## Removed

US Alpaca trading, paper broker, Kafka, Celery, LangGraph agents, marketplace, backtest, old screener, unused models/repos.
