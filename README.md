# NSE/BSE AI Trading Signals Terminal

A full-stack, real-time Indian stock market trading terminal with AI-generated signals, live market data, options chain analysis, technical indicators, charting, backtesting, and Bhavcopy analytics.

---

## Application Overview

### What It Does

| Feature | Description |
|---|---|
| Live Dashboard | Index quotes (NIFTY, BANKNIFTY, SENSEX, etc.), top gainers/losers, market movers |
| Signals Board | AI-generated BUY/SELL/EXIT signals with confidence score, entry, target, stop-loss |
| Market Feed | Live quotes for NSE/BSE stocks with auto-refresh during market hours |
| Options Chain | Live NSE options data → Yahoo Finance fallback → Synthetic data, with OI, IV, bid/ask |
| Futures | Simulated futures contracts (NIFTY, BANKNIFTY, RELIANCE, TCS, INFY) with basis & OI |
| Technical Analysis | RSI, MACD, SMA, EMA, Bollinger Bands, ATR, Stochastic — computed server-side |
| Charts | Interactive candlestick / line / area charts (lightweight-charts) with overlay indicators |
| Backtest | Options strategy backtester using Black-Scholes + historical Yahoo Finance price data |
| Bhavcopy | Upload and analyse NSE daily Bhavcopy ZIP/CSV — gainers, losers, delivery%, bulk deals |
| Watchlist | Persist your own symbol watchlist with live price quotes |
| Settings | Configure AI providers (NVIDIA, OpenAI, Anthropic, Gemini) and chart defaults |

### AI Signal Generation

- **Primary model:** NVIDIA Qwen (via `NVIDIA_API_KEY`)
- **Fallbacks (in order):** OpenAI → Anthropic Claude → Google Gemini
- **Scheduler:** auto-generates signals every 30 minutes during IST market hours (09:15–15:30, Mon–Fri)
- **Expiry:** stale signals auto-expire every 5 minutes

---

## Tech Stack & Versions

### Runtime & Package Manager

| Tool | Version |
|---|---|
| Node.js | 20+ (tested on v24.13.0) |
| pnpm | 10+ (tested on v10.26.1) |
| TypeScript | ~5.9.2 |

### Backend — `artifacts/api-server`

| Library | Version | Purpose |
|---|---|---|
| Express | ^5 | HTTP server & REST API |
| Drizzle ORM | ^0.45.2 | PostgreSQL ORM |
| drizzle-kit | latest | DB migrations & schema push |
| yahoo-finance2 | ^3.14.0 | Market data (quotes, history, options) |
| technicalindicators | ^3.1.0 | RSI, MACD, BB, ATR, Stochastic |
| openai | ^6.27.0 | OpenAI & NVIDIA API client |
| @anthropic-ai/sdk | ^0.92.0 | Anthropic Claude client |
| pino / pino-http | ^9 / ^10 | Structured JSON logging |
| cors | ^2 | Cross-origin headers |
| cookie-parser | ^1.4.7 | NSE session cookie management |
| esbuild | ^0.27.3 | Production bundler |
| zod | ^3.25.76 | Schema validation |

### Frontend — `artifacts/market-dashboard`

| Library | Version | Purpose |
|---|---|---|
| React | 19.1.0 | UI framework |
| Vite | ^7.3.2 | Dev server & bundler |
| Tailwind CSS | ^4.1.14 | Utility-first styling |
| shadcn/ui (Radix) | various | Component library |
| TanStack Query | ^5.90.21 | Data fetching & caching |
| wouter | ^3.3.5 | Client-side routing |
| lightweight-charts | ^5.2.0 | Candlestick / TradingView-style charts |
| recharts | ^2.15.2 | Backtest P&L area charts |
| framer-motion | ^12.23.24 | Animations |
| jszip | ^3.10.1 | Bhavcopy ZIP parsing in-browser |
| lucide-react | ^0.545.0 | Icons |
| zod | ^3.25.76 | Client-side validation |

### Database

| Tool | Description |
|---|---|
| PostgreSQL | 14+ — primary database |
| Drizzle ORM | Schema definitions + query builder |

#### Database Tables

| Table | Purpose |
|---|---|
| `signals` | AI trading signals (action, entry, target, stop-loss, confidence, status) |
| `watchlist` | User-saved symbols |
| `provider_settings` | AI provider API keys (OpenAI, Anthropic, Gemini) stored securely in DB |
| `conversations` | AI agent conversation history |
| `messages` | Individual AI agent messages |

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/          # Express REST API (Node.js ESM)
│   │   └── src/
│   │       ├── routes/      # market, signals, analysis, watchlist, agent, scheduler
│   │       └── lib/         # NSE client, multi-AI, scheduler, logger
│   └── market-dashboard/    # React + Vite frontend
│       └── src/
│           ├── pages/       # 11 pages (dashboard, signals, options, charts, etc.)
│           ├── components/  # sidebar, live-refresh-bar, shadcn UI
│           └── hooks/       # use-live-refresh, use-toast
├── lib/
│   ├── db/                  # Drizzle schema + DB client (shared lib)
│   ├── api-spec/            # OpenAPI spec + codegen
│   └── api-client-react/    # Generated TanStack Query hooks
├── pnpm-workspace.yaml      # Monorepo config & catalog
└── package.json             # Root scripts
```

---

## Local Installation — Step by Step

### Prerequisites

- **Node.js** v20 or newer → https://nodejs.org
- **pnpm** v10 or newer → https://pnpm.io/installation
- **PostgreSQL** v14 or newer → https://www.postgresql.org/download

Verify installations:

```bash
node --version    # should print v20.x or higher
pnpm --version    # should print 10.x or higher
psql --version    # should print 14.x or higher
```

---

### Step 1 — Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

---

### Step 2 — Fix pnpm Workspace Config for Non-Linux Systems

> **macOS / Windows only.** The workspace strips non-Linux esbuild/rollup binaries for Replit's server environment. You must remove those overrides to run locally.

Open `pnpm-workspace.yaml` and **delete the entire `overrides:` block** (from line `overrides:` down to the end of the file). Keep everything above it intact.

---

### Step 3 — Install Dependencies

```bash
pnpm install
```

This installs all packages for every workspace (api-server, market-dashboard, shared libs) in one command.

---

### Step 4 — Create the PostgreSQL Database

```bash
psql -U postgres
```

Inside the psql prompt:

```sql
CREATE DATABASE trading_terminal;
CREATE USER trading_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE trading_terminal TO trading_user;
\q
```

---

### Step 5 — Set Up Environment Variables

Create a `.env` file in the project root:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://trading_user:your_password@localhost:5432/trading_terminal

# ── API Server ────────────────────────────────────────────────────────────────
PORT=3001

# ── AI (Primary — NVIDIA Qwen) ────────────────────────────────────────────────
# Get a free key at: https://build.nvidia.com
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
```

> **OpenAI, Anthropic, Gemini keys** are optional and stored in the database via the Settings page in the UI, not as environment variables.

---

### Step 6 — Run Database Migrations

```bash
cd lib/db
DATABASE_URL=postgresql://trading_user:your_password@localhost:5432/trading_terminal \
  pnpm drizzle-kit push
cd ../..
```

This creates all five tables (`signals`, `watchlist`, `provider_settings`, `conversations`, `messages`).

Verify the tables were created:

```bash
psql -U trading_user -d trading_terminal -c "\dt"
```

---

### Step 7 — Build Shared Libraries

The frontend and API server both depend on shared packages (`@workspace/db`, `@workspace/api-zod`, `@workspace/api-client-react`). Build them first:

```bash
pnpm run typecheck:libs
```

---

### Step 8 — Start the API Server

Open a terminal and run:

```bash
PORT=3001 DATABASE_URL=postgresql://trading_user:your_password@localhost:5432/trading_terminal \
  pnpm --filter @workspace/api-server run dev
```

The server starts at **http://localhost:3001**

Test it is running:

```bash
curl http://localhost:3001/api/healthz
# Expected: {"status":"ok", ...}
```

---

### Step 9 — Start the Frontend

Open a second terminal and run:

```bash
PORT=5173 BASE_PATH=/ \
  pnpm --filter @workspace/market-dashboard run dev
```

The frontend starts at **http://localhost:5173**

---

### Step 10 — Configure API Base URL (Local Only)

In Replit, a reverse proxy routes `/api` to the API server automatically. Locally you need to tell Vite to forward API requests. Add a `server.proxy` block to `artifacts/market-dashboard/vite.config.ts`:

```ts
server: {
  port,
  strictPort: true,
  host: "0.0.0.0",
  allowedHosts: true,
  proxy: {
    "/api": {
      target: "http://localhost:3001",
      changeOrigin: true,
    },
  },
  fs: { strict: true },
},
```

Restart the frontend dev server after saving this change.

---

### Step 11 — Open the App

Navigate to **http://localhost:5173** in your browser.

---

## All API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| GET | `/api/market/quotes` | Live stock quotes |
| GET | `/api/market/indices` | Index data (NSE → Yahoo fallback) |
| GET | `/api/market/movers` | Top gainers / losers / most active |
| GET | `/api/market/options-chain` | Options chain (NSE → Yahoo → Synthetic) |
| GET | `/api/market/futures` | Futures contracts |
| GET | `/api/market/history` | OHLCV history (Yahoo Finance) |
| GET | `/api/market/search` | Symbol search |
| GET | `/api/analysis/:symbol` | Technical indicators for a symbol |
| GET | `/api/signals` | List signals (filter by type/action/status) |
| POST | `/api/signals/generate` | Generate AI signals on demand |
| GET | `/api/watchlist` | Get watchlist |
| POST | `/api/watchlist` | Add symbol to watchlist |
| DELETE | `/api/watchlist/:id` | Remove from watchlist |
| GET | `/api/scheduler/status` | Scheduler status |
| POST | `/api/scheduler/expire` | Manually expire stale signals |
| POST | `/api/scheduler/generate` | Manually trigger AI signal generation |
| GET | `/api/ai-providers` | List AI provider settings |
| POST | `/api/ai-providers` | Save AI provider API key |
| POST | `/api/openai/agent/analyze` | AI agent market analysis |

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | Yes | Port for each service (different per process) |
| `BASE_PATH` | Yes (frontend) | URL base path (`/` locally, auto-set on Replit) |
| `NVIDIA_API_KEY` | Recommended | NVIDIA Build API key for Qwen AI model |
| `OPENAI_API_KEY` | Optional | Set in UI Settings page instead |

---

## Running in Production

### Build all packages

```bash
pnpm run build
```

### Start the API server

```bash
PORT=3001 DATABASE_URL=<your-db-url> NVIDIA_API_KEY=<key> \
  node --enable-source-maps artifacts/api-server/dist/index.mjs
```

### Serve the frontend (static)

```bash
PORT=8080 BASE_PATH=/ \
  pnpm --filter @workspace/market-dashboard run serve
```

Or copy `artifacts/market-dashboard/dist/public/` to any static host (Nginx, Vercel, etc.) and proxy `/api/*` to your API server.

---

## Data Sources

| Data | Source | Notes |
|---|---|---|
| Index quotes | NSE India live API → Yahoo Finance fallback | NSE uses cookie/session (4-min TTL) |
| Stock quotes | Yahoo Finance (`yahoo-finance2`) | Real-time during market hours |
| Options chain | NSE India live → Yahoo Finance → Synthetic | Synthetic data labeled in UI |
| Historical OHLCV | Yahoo Finance | Used by Charts & Backtest pages |
| Futures OI | Simulated | No free real futures OI data source |
| Bhavcopy | Uploaded by user | Processed entirely in the browser |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `PORT is required` error | Make sure you pass `PORT=...` before the start command |
| `DATABASE_URL` not found | Check `.env` file path and that you exported the variable |
| esbuild binary missing (macOS/Windows) | Remove the `overrides:` block from `pnpm-workspace.yaml` and run `pnpm install` again |
| API calls return 404 on frontend | Add the Vite `proxy` config in Step 10 |
| NSE data not loading | NSE blocks non-Indian IPs; Yahoo Finance fallback activates automatically |
| No AI signals generated | Add a valid `NVIDIA_API_KEY` in `.env` or set OpenAI/Anthropic key in Settings page |
| DB tables missing | Re-run `drizzle-kit push` from the `lib/db` directory |
