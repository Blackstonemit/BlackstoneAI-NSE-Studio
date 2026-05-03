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
| cross-env | latest | Cross-platform environment variables |
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

## Local Installation — Windows (Step by Step)

### Prerequisites

Install each of these before continuing:

| Tool | Where to get it |
|---|---|
| **Node.js v20+** | https://nodejs.org — choose the LTS installer (.msi) |
| **pnpm v10+** | Run `npm install -g pnpm` after Node.js is installed |
| **PostgreSQL 14+** | https://www.postgresql.org/download/windows — use the EDB installer |
| **Git** | https://git-scm.com/download/win — needed to clone the repo |

Open **PowerShell** (or Windows Terminal with PowerShell) and verify:

```powershell
node --version    # v20.x or higher
pnpm --version    # 10.x or higher
psql --version    # 14.x or higher
git --version
```

---

### Step 1 — Clone the Repository

```powershell
git clone <your-repo-url>
cd <repo-folder>
```

---

### Step 2 — Fix `pnpm-workspace.yaml` for Windows

The workspace file strips Windows-specific native binaries to reduce size on Replit's Linux servers. **You must remove those entries before installing on Windows**, otherwise esbuild, Vite, Rollup and Tailwind CSS will fail to find their native modules.

Open `pnpm-workspace.yaml` in any text editor and **delete the entire `overrides:` block** — everything from the line that says `overrides:` down to the very end of the file. Keep all lines above it (`minimumReleaseAge`, `packages`, `catalog`, etc.).

The block to delete starts at this line:
```yaml
overrides:
  # replit uses linux-x64 only, we can exclude all other platforms
  "esbuild>@esbuild/darwin-arm64": "-"
  ...
```

Save the file after deleting that section.

---

### Step 3 — Fix the Root `preinstall` Script

The root `package.json` has a preinstall hook that uses a Unix shell command (`sh -c`). On Windows this will fail unless you have Git Bash. The safest fix is to **remove the `preinstall` line** from the root `package.json`.

Open `package.json` in the root folder. Find and remove this line:

```json
"preinstall": "sh -c 'rm -f package-lock.json yarn.lock; case \"$npm_config_user_agent\" in pnpm/*) ;; *) echo \"Use pnpm instead\" >&2; exit 1 ;; esac'",
```

Make sure the `scripts` object still has valid JSON (no trailing comma on the last remaining script).

---

### Step 4 — Install All Dependencies

```powershell
pnpm install
```

This installs packages for all workspace packages in one step.

---

### Step 5 — Create the PostgreSQL Database

Open the **SQL Shell (psql)** that was installed with PostgreSQL, or run:

```powershell
psql -U postgres
```

Inside the psql prompt, run:

```sql
CREATE DATABASE trading_terminal;
CREATE USER trading_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE trading_terminal TO trading_user;
\q
```

---

### Step 6 — Create a `.env` File

Create a file named `.env` in the **project root** (same folder as `package.json`):

```env
DATABASE_URL=postgresql://trading_user:yourpassword@localhost:5432/trading_terminal
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
```

> Get a free NVIDIA API key at https://build.nvidia.com — it is used for AI signal generation.

---

### Step 7 — Run Database Migrations

Open a PowerShell window and run:

```powershell
cd lib\db
$env:DATABASE_URL="postgresql://trading_user:yourpassword@localhost:5432/trading_terminal"
pnpm drizzle-kit push
cd ..\..
```

This creates all five database tables. Verify with:

```powershell
psql -U trading_user -d trading_terminal -c "\dt"
```

You should see: `signals`, `watchlist`, `provider_settings`, `conversations`, `messages`.

---

### Step 8 — Build Shared Libraries

```powershell
pnpm run typecheck:libs
```

This compiles the shared `@workspace/db`, `@workspace/api-zod`, and `@workspace/api-client-react` packages that both the server and frontend depend on.

---

### Step 9 — Add the Vite Proxy (Required for Local)

On Replit a reverse proxy routes `/api` to the API server automatically. Locally you must configure Vite to do this.

Open `artifacts/market-dashboard/vite.config.ts` and add the `proxy` key inside the `server` block:

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

---

### Step 10 — Start the API Server

Open a **new PowerShell window** and run:

```powershell
$env:PORT="3001"
$env:DATABASE_URL="postgresql://trading_user:yourpassword@localhost:5432/trading_terminal"
$env:NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
pnpm --filter @workspace/api-server run dev
```

Wait until you see:

```
Server listening  {"port":3001}
Scheduler started
```

Test it is working:

```powershell
curl http://localhost:3001/api/healthz
```

Expected response: `{"status":"ok", ...}`

---

### Step 11 — Start the Frontend

Open a **second PowerShell window** and run:

```powershell
$env:PORT="5173"
$env:BASE_PATH="/"
pnpm --filter @workspace/market-dashboard run dev
```

Wait until you see:

```
VITE v7.x  ready in ...ms
➜  Local: http://localhost:5173/
```

---

### Step 12 — Open the App

Open your browser and go to:

```
http://localhost:5173
```

All 11 pages should load and work correctly.

---

## Using a `.env` File Automatically (Optional)

Instead of setting `$env:` variables in every terminal session, install `dotenv-cli` globally:

```powershell
npm install -g dotenv-cli
```

Then start each service using:

```powershell
# API server
dotenv -e .env -- pnpm --filter @workspace/api-server run dev

# Frontend (add PORT and BASE_PATH to your .env too)
dotenv -e .env -- pnpm --filter @workspace/market-dashboard run dev
```

Add these lines to your `.env` file:

```env
DATABASE_URL=postgresql://trading_user:yourpassword@localhost:5432/trading_terminal
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
PORT=3001
BASE_PATH=/
```

> Note: PORT and BASE_PATH differ between the two processes, so you will still need to set PORT per-terminal unless you use two separate `.env` files.

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
| `PORT` | Yes | Port for each service (3001 for API, 5173 for frontend) |
| `BASE_PATH` | Yes (frontend) | URL base path — use `/` locally |
| `NVIDIA_API_KEY` | Recommended | NVIDIA Build API key for Qwen AI model |

> **OpenAI, Anthropic, and Gemini keys** are optional and stored in the database via the Settings page in the app — not as environment variables.

---

## Data Sources

| Data | Source | Notes |
|---|---|---|
| Index quotes | NSE India live API → Yahoo Finance fallback | NSE uses cookie/session (4-min TTL) |
| Stock quotes | Yahoo Finance (`yahoo-finance2`) | Real-time during market hours |
| Options chain | NSE India live → Yahoo Finance → Synthetic | Synthetic data is labeled in UI |
| Historical OHLCV | Yahoo Finance | Used by Charts & Backtest pages |
| Futures OI | Simulated | No free real futures OI data source available |
| Bhavcopy | Uploaded by user | Processed entirely in the browser, nothing sent to server |

---

## Windows Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `pnpm install` fails with missing binary | Windows binaries removed in `overrides:` | Delete the entire `overrides:` block from `pnpm-workspace.yaml` |
| `sh: command not found` during install | `preinstall` uses Unix shell | Remove the `preinstall` line from root `package.json` |
| `export: command not found` when starting API | Old Unix-style `export` in dev script | Already fixed — uses `cross-env` now |
| API calls return 404 on the frontend | No proxy configured locally | Add the Vite `proxy` config in Step 9 |
| `PORT is required` error | Environment variable not set | Use `$env:PORT="3001"` in PowerShell before running |
| `DATABASE_URL` not found | `.env` not loaded automatically | Set with `$env:DATABASE_URL="..."` or use `dotenv-cli` |
| NSE live data not loading | NSE blocks non-Indian IPs | Normal — Yahoo Finance fallback activates automatically |
| No AI signals generated | Missing NVIDIA key | Add `NVIDIA_API_KEY` to `.env` or set an OpenAI/Anthropic key in the Settings page |
| DB tables missing after push | Migration did not run | Re-run `pnpm drizzle-kit push` from the `lib\db` directory |
| `psql` not found | PostgreSQL bin not in PATH | Add `C:\Program Files\PostgreSQL\<version>\bin` to your Windows PATH |
