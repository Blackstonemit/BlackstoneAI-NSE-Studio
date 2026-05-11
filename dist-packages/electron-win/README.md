# NSE/BSE AI Trading Terminal — Windows Desktop App

A full Electron desktop application that bundles the Express backend and React frontend locally on your Windows PC. Requires internet for live market data and AI signals.

## Requirements

- **Windows 10 / 11** (64-bit)
- **Node.js 20 LTS or higher** — download from https://nodejs.org
- **PostgreSQL** (optional — for signals history and watchlist persistence)
- **Internet connection** — for live NSE/BSE data and AI signals

## Quick Start

### 1. Install dependencies

Open a terminal (Command Prompt or PowerShell) in this folder:

```cmd
npm install
```

This installs Electron, esbuild, and all server dependencies (~500 MB, takes 2-5 min).

### 2. Copy the source code

This Electron project needs the server and frontend source files from the monorepo.
Copy the following into the `src/` folder (already set up):

```
src/
  server/       ← copy from artifacts/api-server/src/
  frontend/     ← copy from artifacts/market-dashboard/src/
```

Or if you downloaded the full monorepo, run:

```cmd
npm run sync-from-monorepo
```

### 3. Set environment variables (optional)

Create a `.env` file in this folder:

```env
# PostgreSQL connection (for signals/watchlist persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/trading_db

# AI integration (for trading signals)
AI_INTEGRATIONS_OPENAI_BASE_URL=https://...
AI_INTEGRATIONS_OPENAI_API_KEY=your-key-here

# Or use direct OpenAI key:
OPENAI_API_KEY=sk-...
```

Without a database, the app runs fine but signals and watchlist won't persist between sessions.

### 4. Build and launch

```cmd
npm run dev
```

This builds the frontend (Vite) and server (esbuild) then opens Electron.

### 5. Build a distributable .exe installer

```cmd
npm run dist
```

Output: `release/NSE BSE Trading Terminal Setup 1.0.0.exe` (installer) and `release/NSE BSE Trading Terminal 1.0.0.exe` (portable)

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` | Live Dashboard |
| `Ctrl+2` | Signals Board |
| `Ctrl+3` | Market Feed |
| `Ctrl+4` | Charts |
| `Ctrl+5` | Technical Analysis |
| `Ctrl+6` | Options Chain |
| `Ctrl+7` | Futures |
| `Ctrl+R` | Reload |
| `F11` | Fullscreen |
| `F12` | DevTools |
| `Ctrl++/-/0` | Zoom in/out/reset |

## Notes

- Market data is delayed 15-20 minutes (Yahoo Finance)
- Indian market hours: 9:15 AM – 3:30 PM IST
- Signals are AI-generated — not financial advice

## Troubleshooting

**"Server bundle not found"** — Run `npm run dev` (not `npm start`) which builds first.

**Port 8765 already in use** — Change `SERVER_PORT` in `electron/main.js` to any free port.

**AI signals not working** — Set `OPENAI_API_KEY` or Replit AI integration env vars in your `.env`.
