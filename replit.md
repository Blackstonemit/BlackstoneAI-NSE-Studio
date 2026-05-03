# NSE/BSE AI Trading Signals

## Overview

An agentic AI application for professional technical analysis of Indian stock exchange (NSE/BSE) data. Provides a live market dashboard, technical indicators, and AI-generated trading signals for stocks, options, and futures. No broker integration — signals only.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (market-dashboard artifact)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Market data**: yahoo-finance2 (NSE/BSE via Yahoo Finance)
- **Technical analysis**: technicalindicators (RSI, MACD, Bollinger Bands, Stochastic, ATR, SMA, EMA)
- **AI Agent**: OpenAI (via Replit AI Integrations, no API key required)

## Artifacts

- **market-dashboard** (`/`) — React dashboard with live indices, market feed, options chain, futures, technical analysis, signals board, and watchlist
- **api-server** (`/api`) — Express backend serving all market data, technical analysis, and AI agent routes

## Key Features

1. **Live Market Dashboard** — Real-time NSE/BSE indices (NIFTY 50, BANK NIFTY, SENSEX), market movers, and active signals feed
2. **AI Trading Signals** — AI agent (GPT-5.4) analyzes technical indicators and generates BUY/SELL/EXIT signals with entry, target, and stop-loss levels
3. **Technical Analysis Engine** — RSI, MACD, Bollinger Bands, SMA 20/50/200, EMA 9/21, ATR, Stochastic
4. **Options Chain** — Live NSE options data (CE/PE) with strike prices, OI, IV
5. **Futures** — Live futures data for NIFTY, BANKNIFTY, and major stocks
6. **Watchlist** — Manage tracked symbols with add/remove functionality
7. **Auto-refresh** — Market data refreshes every 30 seconds

## Data Sources

- **Yahoo Finance** (via `yahoo-finance2`) — Real-time and historical price data for NSE (.NS) and BSE (.BO) listed securities
- **AI Analysis** — OpenAI GPT-5.4 for signal generation and comprehensive reports
- **Note**: Yahoo Finance provides delayed data (15-20 min) for Indian markets; indices show 0 when market is closed (Indian market hours: 9:15 AM – 3:30 PM IST)

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/market/quotes` | Live quotes for symbol list |
| GET | `/api/market/indices` | Major Indian indices |
| GET | `/api/market/options-chain` | Options chain for a symbol |
| GET | `/api/market/futures` | Futures data |
| GET | `/api/market/history` | OHLCV historical data |
| GET | `/api/market/movers` | Top gainers, losers, most active |
| GET | `/api/analysis/technical` | Technical indicators for a symbol |
| GET | `/api/analysis/summary` | Market-wide analysis summary |
| GET | `/api/signals` | All trading signals (filterable) |
| POST | `/api/signals/generate` | AI-generate new signals |
| GET/POST/DELETE | `/api/watchlist` | Watchlist management |
| POST | `/api/openai/agent/analyze` | Full AI agent analysis report |

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Tables

- `watchlist` — Tracked symbols (symbol, name, exchange, instrumentType)
- `signals` — AI-generated trading signals with entry/target/stopLoss, confidence, rationale, status
- `conversations` — AI conversation history
- `messages` — AI conversation messages

## Important Notes

- **No broker integration** — application provides signals only, never connects to brokerage accounts
- **Market hours** — Indian markets open 9:15 AM – 3:30 PM IST; data shows as 0 when closed
- **Options data** — Falls back to synthetic options chain when Yahoo Finance doesn't provide options data for an instrument
- **Signal disclaimer** — Signals are AI-generated based on technical analysis; always do your own research before trading
