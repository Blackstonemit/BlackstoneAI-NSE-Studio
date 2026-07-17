import { useState } from "react";

const INDICES = [
  { symbol: "NIFTY50", name: "NIFTY 50", value: 24081.10, change: 22.20, pct: 0.09, high: 24196, low: 24040, sparkline: [23900, 23980, 23850, 24020, 24100, 23950, 24050, 24150, 24110, 24081] },
  { symbol: "BANKNIFTY", name: "BANK NIFTY", value: 51843.30, change: -124.55, pct: -0.24, high: 52100, low: 51700, sparkline: [51600, 51800, 51500, 51900, 52000, 51800, 51700, 51900, 51870, 51843] },
  { symbol: "FINNIFTY", name: "FINNIFTY", value: 23956.45, change: -55.10, pct: -0.23, high: 24100, low: 23900, sparkline: [24000, 24050, 23900, 24020, 24100, 23950, 23980, 23970, 23960, 23956] },
  { symbol: "SENSEX", name: "SENSEX", value: 79332.15, change: 84.30, pct: 0.11, high: 79600, low: 79100, sparkline: [79000, 79200, 79100, 79300, 79450, 79200, 79350, 79400, 79320, 79332] },
];

const GAINERS = [
  { symbol: "ADANIENT", price: 2845.60, pct: 4.32 },
  { symbol: "HCLTECH", price: 1624.45, pct: 2.87 },
  { symbol: "WIPRO", price: 498.30, pct: 2.14 },
  { symbol: "SBILIFE", price: 1521.75, pct: 1.93 },
  { symbol: "LTIM", price: 5876.20, pct: 1.72 },
];

const LOSERS = [
  { symbol: "BAJFINANCE", price: 7124.50, pct: -2.41 },
  { symbol: "POWERGRID", price: 291.80, pct: -1.89 },
  { symbol: "NTPC", price: 354.25, pct: -1.54 },
  { symbol: "BPCL", price: 323.40, pct: -1.32 },
  { symbol: "COALINDIA", price: 486.75, pct: -1.18 },
];

const SIGNALS = [
  { action: "BUY", symbol: "RELIANCE", display: "RELIANCE · NSE", entry: 2842.50, target: 2960.00, sl: 2780.00, conf: 87, tf: "INTRADAY", rationale: "RSI oversold bounce + MACD crossover above signal line. Volume spike confirms breakout." },
  { action: "SELL", symbol: "BAJFINANCE", display: "BAJFINANCE · NSE", entry: 7124.50, target: 6980.00, sl: 7200.00, conf: 74, tf: "INTRADAY", rationale: "Bearish engulfing at resistance. Stochastic overbought (92/88). BB upper band touch." },
  { action: "BUY", symbol: "HCLTECH", display: "HCLTECH · NSE", entry: 1624.45, target: 1695.00, sl: 1590.00, conf: 81, tf: "SWING", rationale: "EMA 9 > EMA 21 crossover. ADX strengthening at 28. Strong delivery volume." },
];

const NAV_GROUPS = [
  {
    label: "MARKET",
    items: [
      { label: "Live Dashboard", active: true },
      { label: "Signals Board" },
      { label: "Market Feed" },
    ],
  },
  {
    label: "DERIVATIVES",
    items: [
      { label: "Options Chain" },
      { label: "Futures" },
    ],
  },
  {
    label: "ANALYSIS",
    items: [
      { label: "Technical Analysis" },
      { label: "Charts" },
      { label: "Backtest" },
      { label: "Scalp Desk (5M)" },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { label: "Multibagger Screen" },
      { label: "Bhavcopy" },
      { label: "Price Alerts" },
      { label: "Watchlist" },
    ],
  },
];

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80, h = 32;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity="0.25" />
          <stop offset="100%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniBar({ val, total, color }: { val: number; total: number; color: string }) {
  return <div style={{ width: `${(val / total) * 100}%`, background: color, height: "100%" }} />;
}

export function OptimizedDashboard() {
  const [activeNav, setActiveNav] = useState("Live Dashboard");
  const bullish = 62, neutral = 18, bearish = 20, total = 100;
  const now = new Date();
  const ist = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        background: "hsl(222 47% 4%)",
        color: "hsl(210 40% 98%)",
        minHeight: "100vh",
        display: "flex",
        fontSize: 13,
      }}
    >
      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 220,
          minWidth: 220,
          background: "hsl(222 47% 3.5%)",
          borderRight: "1px solid hsl(217 33% 13%)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "0 16px", height: 52, display: "flex", alignItems: "center", borderBottom: "1px solid hsl(217 33% 11%)", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: "hsl(217 91% 60%)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><polyline points="2,9 6,5 9,8 13,3" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", color: "hsl(217 91% 70%)" }}>NSE TERMINAL</span>
        </div>

        {/* Market status */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid hsl(217 33% 11%)", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b" }} />
          <span style={{ fontSize: 10, color: "hsl(215 20% 50%)", letterSpacing: "0.12em" }}>MARKET CLOSED</span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "hsl(215 20% 40%)" }}>{ist} IST</span>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{ padding: "8px 16px 4px", fontSize: 9, letterSpacing: "0.15em", color: "hsl(215 20% 35%)", fontWeight: 600 }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = item.label === activeNav;
                return (
                  <button
                    key={item.label}
                    onClick={() => setActiveNav(item.label)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "6px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      color: active ? "#fff" : "hsl(215 20% 55%)",
                      background: active
                        ? "linear-gradient(90deg, hsl(217 91% 60% / 0.18) 0%, transparent 100%)"
                        : "transparent",
                      borderLeft: active ? "2px solid hsl(217 91% 60%)" : "2px solid transparent",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "hsl(217 91% 60%)" : "transparent", border: `1.5px solid ${active ? "hsl(217 91% 60%)" : "hsl(215 20% 30%)"}` }} />
                    {item.label}
                    {item.label === "Signals Board" && (
                      <span style={{ marginLeft: "auto", background: "hsl(217 91% 60% / 0.2)", color: "hsl(217 91% 70%)", borderRadius: 3, padding: "1px 5px", fontSize: 9 }}>
                        3
                      </span>
                    )}
                    {item.label === "Price Alerts" && (
                      <span style={{ marginLeft: "auto", background: "hsl(38 92% 50% / 0.15)", color: "hsl(38 92% 60%)", borderRadius: 3, padding: "1px 5px", fontSize: 9 }}>
                        2
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid hsl(217 33% 11%)" }}>
          <div style={{ background: "hsl(142 71% 45% / 0.08)", border: "1px solid hsl(142 71% 45% / 0.2)", borderRadius: 4, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
              <span style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.1em" }}>SYSTEM ONLINE</span>
            </div>
            <div style={{ fontSize: 10, color: "hsl(215 20% 40%)" }}>LATENCY: <span style={{ color: "#22c55e" }}>12ms</span></div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <header
          style={{
            height: 50,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            borderBottom: "1px solid hsl(217 33% 11%)",
            background: "hsl(222 47% 4% / 0.95)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Search */}
          <div style={{ flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 8, background: "hsl(217 33% 9%)", border: "1px solid hsl(217 33% 15%)", borderRadius: 4, padding: "0 10px", height: 32 }}>
            <svg width="13" height="13" fill="none" stroke="hsl(215 20% 40%)" strokeWidth="2" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4" /><line x1="9" y1="9" x2="12" y2="12" /></svg>
            <span style={{ fontSize: 11, color: "hsl(215 20% 35%)" }}>Search NSE / BSE stocks...</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "hsl(215 20% 30%)", border: "1px solid hsl(217 33% 15%)", borderRadius: 3, padding: "1px 5px" }}>⌘K</span>
          </div>

          {/* Right section */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            {/* Refresh indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "hsl(215 20% 40%)" }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 5.5A4.5 4.5 0 0 1 2 8M1 5.5A4.5 4.5 0 0 1 9 3" /></svg>
              <span>60s</span>
            </div>
            {/* Clock */}
            <div style={{ fontSize: 11, color: "hsl(215 20% 45%)", letterSpacing: "0.05em" }}>
              <span style={{ color: "hsl(215 20% 30%)" }}>IST</span> {ist}
            </div>
            {/* Market closed badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "hsl(38 92% 50% / 0.1)", border: "1px solid hsl(38 92% 50% / 0.25)", borderRadius: 3, padding: "3px 8px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ fontSize: 10, color: "#f59e0b", letterSpacing: "0.1em" }}>CLOSED</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "16px 20px", maxWidth: 1600, margin: "0 auto", width: "100%" }}>
          {/* Page header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: "#fff" }}>LIVE DASHBOARD</h1>
            <div style={{ fontSize: 10, color: "hsl(215 20% 35%)", letterSpacing: "0.08em" }}>
              LAST UPDATE · 15:32:47 IST
            </div>
          </div>

          {/* ── INDICES ──────────────────────────────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "hsl(215 20% 35%)", marginBottom: 8, fontWeight: 600 }}>INDICES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {INDICES.map((idx) => {
                const up = idx.change >= 0;
                return (
                  <div
                    key={idx.symbol}
                    style={{
                      background: "hsl(222 47% 6%)",
                      border: `1px solid ${up ? "hsl(142 71% 45% / 0.12)" : "hsl(0 84% 60% / 0.10)"}`,
                      borderRadius: 4,
                      padding: "12px 14px",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Top glow accent */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: up ? "linear-gradient(90deg, hsl(142 71% 45% / 0.6) 0%, transparent 100%)" : "linear-gradient(90deg, hsl(0 84% 60% / 0.5) 0%, transparent 100%)" }} />

                    <div style={{ fontSize: 10, color: "hsl(215 20% 45%)", marginBottom: 6, letterSpacing: "0.05em" }}>{idx.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", marginBottom: 4 }}>
                      {idx.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>

                    {/* Change row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: up ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 600 }}>
                          {up ? "▲" : "▼"} {Math.abs(idx.pct).toFixed(2)}%
                        </span>
                        <span style={{ color: up ? "hsl(142 60% 40%)" : "hsl(0 60% 50%)", fontSize: 10 }}>
                          {up ? "+" : ""}{idx.change.toFixed(2)}
                        </span>
                      </div>
                      <Sparkline data={idx.sparkline} positive={up} />
                    </div>

                    {/* H/L */}
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: "hsl(215 20% 35%)" }}>
                      <span>H: <span style={{ color: "hsl(215 20% 50%)" }}>{idx.high.toLocaleString("en-IN")}</span></span>
                      <span>L: <span style={{ color: "hsl(215 20% 50%)" }}>{idx.low.toLocaleString("en-IN")}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── MOVERS + BREADTH ─────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 8, marginBottom: 14 }}>
            {/* Gainers / Losers */}
            <div style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(217 33% 13%)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid hsl(217 33% 11%)" }}>
                <div style={{ flex: 1, padding: "8px 14px", fontSize: 9, letterSpacing: "0.15em", color: "#22c55e", borderRight: "1px solid hsl(217 33% 11%)", fontWeight: 600 }}>▲ TOP GAINERS</div>
                <div style={{ flex: 1, padding: "8px 14px", fontSize: 9, letterSpacing: "0.15em", color: "#ef4444", fontWeight: 600 }}>▼ TOP LOSERS</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", divideX: "1px solid red" }}>
                {/* Gainers */}
                <div style={{ borderRight: "1px solid hsl(217 33% 11%)" }}>
                  {GAINERS.map((g) => (
                    <div
                      key={g.symbol}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderBottom: "1px solid hsl(217 33% 8%)" }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{g.symbol}</div>
                        <div style={{ fontSize: 10, color: "hsl(215 20% 40%)" }}>₹{g.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>+{g.pct.toFixed(2)}%</span>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button style={{ padding: "2px 7px", fontSize: 9, background: "hsl(142 71% 45% / 0.15)", border: "1px solid hsl(142 71% 45% / 0.3)", borderRadius: 2, color: "#22c55e", cursor: "pointer" }}>B</button>
                          <button style={{ padding: "2px 7px", fontSize: 9, background: "hsl(0 84% 60% / 0.1)", border: "1px solid hsl(0 84% 60% / 0.25)", borderRadius: 2, color: "#ef4444", cursor: "pointer" }}>S</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Losers */}
                <div>
                  {LOSERS.map((l) => (
                    <div
                      key={l.symbol}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderBottom: "1px solid hsl(217 33% 8%)" }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{l.symbol}</div>
                        <div style={{ fontSize: 10, color: "hsl(215 20% 40%)" }}>₹{l.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{l.pct.toFixed(2)}%</span>
                        <div style={{ display: "flex", gap: 3 }}>
                          <button style={{ padding: "2px 7px", fontSize: 9, background: "hsl(142 71% 45% / 0.15)", border: "1px solid hsl(142 71% 45% / 0.3)", borderRadius: 2, color: "#22c55e", cursor: "pointer" }}>B</button>
                          <button style={{ padding: "2px 7px", fontSize: 9, background: "hsl(0 84% 60% / 0.1)", border: "1px solid hsl(0 84% 60% / 0.25)", borderRadius: 2, color: "#ef4444", cursor: "pointer" }}>S</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Market Breadth */}
            <div style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(217 33% 13%)", borderRadius: 4, padding: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid hsl(217 33% 11%)", fontSize: 9, letterSpacing: "0.15em", color: "hsl(215 20% 45%)", fontWeight: 600 }}>MARKET BREADTH</div>
              <div style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Gauge */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "hsl(215 20% 40%)" }}>
                    <span>Analyzed</span><span style={{ color: "hsl(215 20% 60%)" }}>{total} symbols</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "hsl(217 33% 11%)", overflow: "hidden", display: "flex" }}>
                    <MiniBar val={bullish} total={total} color="#22c55e" />
                    <MiniBar val={neutral} total={total} color="hsl(217 33% 22%)" />
                    <MiniBar val={bearish} total={total} color="#ef4444" />
                  </div>
                </div>

                {/* Counts */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "BULLISH", val: bullish, pct: bullish, color: "#22c55e", bg: "hsl(142 71% 45% / 0.08)", border: "hsl(142 71% 45% / 0.2)" },
                    { label: "NEUTRAL", val: neutral, pct: neutral, color: "hsl(215 20% 50%)", bg: "hsl(217 33% 10%)", border: "hsl(217 33% 18%)" },
                    { label: "BEARISH", val: bearish, pct: bearish, color: "#ef4444", bg: "hsl(0 84% 60% / 0.07)", border: "hsl(0 84% 60% / 0.18)" },
                  ].map((item) => (
                    <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.border}`, borderRadius: 3, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: item.color, letterSpacing: "0.1em" }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.val}<span style={{ fontSize: 9, fontWeight: 400, color: item.color, opacity: 0.7 }}>%</span></span>
                    </div>
                  ))}
                </div>

                {/* Sentiment */}
                <div style={{ marginTop: "auto", padding: "8px 10px", background: "hsl(142 71% 45% / 0.06)", border: "1px solid hsl(142 71% 45% / 0.15)", borderRadius: 3 }}>
                  <div style={{ fontSize: 9, color: "hsl(215 20% 40%)", letterSpacing: "0.1em", marginBottom: 2 }}>OVERALL SENTIMENT</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>BULLISH</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTIVE SIGNALS ───────────────────────────────────── */}
          <div style={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(217 33% 13%)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid hsl(217 33% 11%)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "hsl(215 20% 45%)", fontWeight: 600 }}>ACTIVE SIGNALS</span>
              <span style={{ background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 70%)", borderRadius: 3, padding: "1px 6px", fontSize: 9 }}>{SIGNALS.length} LIVE</span>
              <span style={{ marginLeft: "auto", fontSize: 9, color: "hsl(215 20% 35%)" }}>CONFIDENCE ·</span>
              <span style={{ fontSize: 9, color: "hsl(217 91% 60%)" }}>AI GPT-5.4</span>
            </div>

            {SIGNALS.map((sig, i) => {
              const isBuy = sig.action === "BUY";
              const isSell = sig.action === "SELL";
              const actionColor = isBuy ? "#22c55e" : isSell ? "#ef4444" : "#f59e0b";
              const actionBg = isBuy ? "hsl(142 71% 45% / 0.12)" : isSell ? "hsl(0 84% 60% / 0.12)" : "hsl(38 92% 50% / 0.12)";
              const actionBorder = isBuy ? "hsl(142 71% 45% / 0.3)" : isSell ? "hsl(0 84% 60% / 0.3)" : "hsl(38 92% 50% / 0.3)";

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "10px 14px",
                    borderBottom: i < SIGNALS.length - 1 ? "1px solid hsl(217 33% 9%)" : undefined,
                    borderLeft: `2px solid ${actionColor}`,
                    transition: "background 0.1s",
                  }}
                >
                  {/* Action badge */}
                  <div style={{ background: actionBg, border: `1px solid ${actionBorder}`, borderRadius: 3, padding: "4px 10px", minWidth: 42, textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: actionColor, letterSpacing: "0.08em" }}>{sig.action}</span>
                  </div>

                  {/* Symbol */}
                  <div style={{ minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sig.symbol}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: "hsl(215 20% 40%)", letterSpacing: "0.05em" }}>NSE</span>
                      <span style={{ fontSize: 9, background: "hsl(217 91% 60% / 0.1)", color: "hsl(217 91% 65%)", borderRadius: 2, padding: "0 4px" }}>{sig.tf}</span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ flex: 1, maxWidth: 100 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 9, color: "hsl(215 20% 35%)" }}>CONFIDENCE</span>
                      <span style={{ fontSize: 9, color: actionColor, fontWeight: 600 }}>{sig.conf}%</span>
                    </div>
                    <div style={{ height: 3, background: "hsl(217 33% 11%)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${sig.conf}%`, height: "100%", background: actionColor, borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Price levels */}
                  <div style={{ display: "flex", gap: 20, marginLeft: "auto" }}>
                    {[
                      { label: "ENTRY", val: sig.entry, color: "hsl(215 20% 55%)" },
                      { label: "TARGET", val: sig.target, color: "#22c55e" },
                      { label: "SL", val: sig.sl, color: "#ef4444" },
                    ].map((p) => (
                      <div key={p.label} style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: "hsl(215 20% 35%)", letterSpacing: "0.08em" }}>{p.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: p.color, marginTop: 1 }}>
                          ₹{p.val.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trade actions */}
                  <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                    <button style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, background: "hsl(142 71% 45% / 0.15)", border: "1px solid hsl(142 71% 45% / 0.35)", borderRadius: 3, color: "#22c55e", cursor: "pointer", letterSpacing: "0.05em" }}>BUY</button>
                    <button style={{ padding: "4px 12px", fontSize: 10, fontWeight: 600, background: "hsl(0 84% 60% / 0.1)", border: "1px solid hsl(0 84% 60% / 0.3)", borderRadius: 3, color: "#ef4444", cursor: "pointer", letterSpacing: "0.05em" }}>SELL</button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* ── BOTTOM TRADE BAR ─────────────────────────────────────── */}
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 220,
          right: 0,
          height: 44,
          background: "hsl(222 47% 4.5%)",
          borderTop: "1px solid hsl(217 33% 11%)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          zIndex: 15,
        }}>
          {/* Symbol selector */}
          {["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "ICICIBANK"].map((s, i) => (
            <button
              key={s}
              style={{
                fontSize: 10,
                color: i === 0 ? "hsl(217 91% 70%)" : "hsl(215 20% 45%)",
                background: i === 0 ? "hsl(217 91% 60% / 0.12)" : "transparent",
                border: i === 0 ? "1px solid hsl(217 91% 60% / 0.25)" : "1px solid transparent",
                borderRadius: 3,
                padding: "2px 8px",
                cursor: "pointer",
                letterSpacing: "0.06em",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}

          {/* Lot size */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "hsl(215 20% 35%)" }}>LOT</span>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid hsl(217 33% 16%)", borderRadius: 3, overflow: "hidden" }}>
              <button style={{ padding: "3px 7px", fontSize: 11, background: "hsl(217 33% 10%)", border: "none", color: "hsl(215 20% 45%)", cursor: "pointer" }}>−</button>
              <span style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "hsl(217 33% 8%)", color: "#fff" }}>1</span>
              <button style={{ padding: "3px 7px", fontSize: 11, background: "hsl(217 33% 10%)", border: "none", color: "hsl(215 20% 45%)", cursor: "pointer" }}>+</button>
            </div>

            {/* Price display */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", minWidth: 80, textAlign: "right" }}>₹24,096.82</div>

            {/* Trade buttons */}
            <button style={{ padding: "6px 18px", fontSize: 11, fontWeight: 700, background: "hsl(142 71% 45%)", border: "none", borderRadius: 3, color: "#000", cursor: "pointer", letterSpacing: "0.06em" }}>▲ BUY</button>
            <button style={{ padding: "6px 18px", fontSize: 11, fontWeight: 700, background: "hsl(0 84% 60%)", border: "none", borderRadius: 3, color: "#fff", cursor: "pointer", letterSpacing: "0.06em" }}>▼ SELL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
