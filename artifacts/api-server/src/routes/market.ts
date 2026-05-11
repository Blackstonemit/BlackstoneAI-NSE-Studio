import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import {
  GetMarketQuotesQueryParams,
  GetMarketHistoryQueryParams,
  GetOptionsChainQueryParams,
  GetFuturesQueryParams,
} from "@workspace/api-zod";
import {
  nseClient,
  nseExpiryToISO,
  NSE_INDEX_SYMBOLS,
  type NseOptionChainResponse,
  type NseAllIndicesResponse,
} from "../lib/nse.js";

const router: IRouter = Router();

// Index symbols that need special Yahoo Finance tickers
const INDEX_YAHOO_MAP: Record<string, string> = {
  NIFTY: "^NSEI",
  NIFTY50: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  NIFTYBANK: "^NSEBANK",
  SENSEX: "^BSESN",
  NIFTYMID: "^NSEMDCP50",
  NIFTYIT: "^CNXIT",
};

// NSE/BSE symbol → Yahoo Finance symbol
function toYahooSymbol(symbol: string, exchange: string = "NSE"): string {
  if (symbol.includes(".") || symbol.startsWith("^")) return symbol;
  const upper = symbol.toUpperCase();
  if (INDEX_YAHOO_MAP[upper]) return INDEX_YAHOO_MAP[upper];
  const suffix = exchange === "BSE" ? ".BO" : ".NS";
  return `${symbol}${suffix}`;
}

// Major indices mapping
const INDICES: Array<{ symbol: string; yahooSymbol: string; name: string }> = [
  { symbol: "NIFTY50", yahooSymbol: "^NSEI", name: "NIFTY 50" },
  { symbol: "BANKNIFTY", yahooSymbol: "^NSEBANK", name: "BANK NIFTY" },
  { symbol: "SENSEX", yahooSymbol: "^BSESN", name: "BSE SENSEX" },
  { symbol: "NIFTYMID", yahooSymbol: "^NSEMDCP50", name: "NIFTY MIDCAP 50" },
  { symbol: "NIFTYIT", yahooSymbol: "^CNXIT", name: "NIFTY IT" },
];

// Default watchlist symbols for movers
const DEFAULT_SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "SBIN.NS",
  "WIPRO.NS",
  "AXISBANK.NS",
  "LT.NS",
  "BAJFINANCE.NS",
  "ADANIENT.NS",
  "HINDUNILVR.NS",
  "ITC.NS",
  "KOTAKBANK.NS",
  "MARUTI.NS",
];

router.get("/market/quotes", async (req, res) => {
  try {
    const query = GetMarketQuotesQueryParams.parse(req.query);
    const symbols = query.symbols.split(",").map((s) => s.trim());
    const yahooSymbols = symbols.map((s) => toYahooSymbol(s, query.exchange));

    const quotes = await Promise.all(
      yahooSymbols.map(async (ySym, i) => {
        try {
          const q = await yahooFinance.quote(ySym);
          const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
          return {
            symbol: symbols[i],
            name: q.longName || q.shortName || symbols[i],
            exchange: query.exchange,
            price,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
            open: q.regularMarketOpen ?? price,
            high: q.regularMarketDayHigh ?? price,
            low: q.regularMarketDayLow ?? price,
            previousClose: q.regularMarketPreviousClose ?? 0,
            marketCap: q.marketCap ?? null,
            timestamp: new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
    );

    res.json(quotes.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch quotes");
    res.status(500).json({ error: "Failed to fetch market quotes" });
  }
});

router.get("/market/indices", async (req, res) => {
  // Try NSE first, fall back to Yahoo Finance
  try {
    const nseData = await nseClient.get<NseAllIndicesResponse>("/allIndices");
    const nseMap = new Map(nseData.data.map((d) => [d.indexSymbol, d]));

    const NSE_INDEX_NAME_MAP: Record<string, string> = {
      NIFTY50:    "NIFTY 50",
      BANKNIFTY:  "NIFTY BANK",
      SENSEX:     "S&P BSE SENSEX",
      NIFTYMID:   "NIFTY MIDCAP 50",
      NIFTYIT:    "NIFTY IT",
    };

    // BSE SENSEX is not in NSE's allIndices — fetch from Yahoo for it
    const sensexYahoo = await yahooFinance.quote("^BSESN").catch(() => null);

    const results = await Promise.all(INDICES.map(async (idx) => {
      // SENSEX: BSE index, use Yahoo Finance
      if (idx.symbol === "SENSEX") {
        const price = sensexYahoo?.regularMarketPrice ?? 0;
        return {
          symbol: idx.symbol,
          name: idx.name,
          value: price,
          change: sensexYahoo?.regularMarketChange ?? 0,
          changePercent: sensexYahoo?.regularMarketChangePercent ?? 0,
          high: sensexYahoo?.regularMarketDayHigh ?? price,
          low: sensexYahoo?.regularMarketDayLow ?? price,
          open: sensexYahoo?.regularMarketOpen ?? price,
          previousClose: sensexYahoo?.regularMarketPreviousClose ?? 0,
          yearHigh: sensexYahoo?.fiftyTwoWeekHigh ?? 0,
          yearLow: sensexYahoo?.fiftyTwoWeekLow ?? 0,
          dataSource: "Yahoo",
          timestamp: new Date().toISOString(),
        };
      }
      const nse = nseMap.get(NSE_INDEX_NAME_MAP[idx.symbol] ?? idx.name);
      if (nse) {
        return {
          symbol: idx.symbol,
          name: idx.name,
          value: nse.last ?? 0,
          change: nse.variation ?? 0,
          changePercent: nse.percentChange ?? 0,
          high: nse.high ?? 0,
          low: nse.low ?? 0,
          open: nse.open ?? 0,
          previousClose: nse.previousClose ?? 0,
          yearHigh: nse.yearHigh ?? 0,
          yearLow: nse.yearLow ?? 0,
          dataSource: "NSE",
          timestamp: nseData.timestamp ?? new Date().toISOString(),
        };
      }
      return {
        symbol: idx.symbol,
        name: idx.name,
        value: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        dataSource: "unavailable",
        timestamp: new Date().toISOString(),
      };
    }));

    res.json(results);
  } catch (nseErr) {
    req.log.warn({ err: nseErr }, "NSE indices failed, falling back to Yahoo");
    try {
      const results = await Promise.all(
        INDICES.map(async (idx) => {
          try {
            const q = await yahooFinance.quote(idx.yahooSymbol);
            const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
            return {
              symbol: idx.symbol,
              name: idx.name,
              value: price,
              change: q.regularMarketChange ?? 0,
              changePercent: q.regularMarketChangePercent ?? 0,
              high: q.regularMarketDayHigh ?? price,
              low: q.regularMarketDayLow ?? price,
              dataSource: "Yahoo",
              timestamp: new Date().toISOString(),
            };
          } catch {
            return { symbol: idx.symbol, name: idx.name, value: 0, change: 0, changePercent: 0, high: 0, low: 0, dataSource: "unavailable", timestamp: new Date().toISOString() };
          }
        })
      );
      res.json(results);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch indices");
      res.status(500).json({ error: "Failed to fetch indices" });
    }
  }
});

router.get("/market/options-chain", async (req, res) => {
  const query = GetOptionsChainQueryParams.parse(req.query);
  const symbol = query.symbol.toUpperCase();

  // ── 1. Try NSE live data ───────────────────────────────────────────────────
  const isIndex = symbol in NSE_INDEX_SYMBOLS || ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(symbol);
  try {
    const endpoint = isIndex
      ? `/option-chain-indices?symbol=${encodeURIComponent(symbol)}`
      : `/option-chain-equities?symbol=${encodeURIComponent(symbol)}`;

    const nse = await nseClient.get<NseOptionChainResponse>(endpoint);
    const records = nse.records;

    if (!records || !records.data || records.data.length === 0) throw new Error("Empty NSE response");

    const underlyingPrice = records.underlyingValue ?? 0;
    const allExpiries = records.expiryDates ?? [];
    const expiries = allExpiries.map(nseExpiryToISO);

    // Pick expiry filter
    let selectedExpiryISO = expiries[0] ?? "";
    let selectedExpiryLabel = allExpiries[0] ?? "";
    if (query.expiry) {
      const idx = expiries.findIndex((e) => e === query.expiry);
      if (idx >= 0) {
        selectedExpiryISO = expiries[idx];
        selectedExpiryLabel = allExpiries[idx];
      }
    }

    // Filter rows to selected expiry and build calls/puts maps
    const rows = records.data.filter((r) => r.expiryDate === selectedExpiryLabel);

    // Build sorted unique strike list
    const strikes = [...new Set(rows.map((r) => r.strikePrice))].sort((a, b) => a - b);

    // Map contracts
    const mapNse = (c: any, type: "CE" | "PE") => ({
      strikePrice: c.strikePrice,
      expiry: selectedExpiryISO,
      type,
      ltp:              c.lastPrice ?? 0,
      change:           c.change ?? 0,
      changePercent:    c.pChange ?? 0,
      volume:           c.totalTradedVolume ?? 0,
      openInterest:     c.openInterest ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      // NSE-specific extras
      changeInOI:       c.changeinOpenInterest ?? 0,
      pChangeInOI:      c.pchangeinOpenInterest ?? 0,
      bid:              c.bidprice ?? 0,
      ask:              c.askPrice ?? 0,
      bidQty:           c.bidQty ?? 0,
      askQty:           c.askQty ?? 0,
      delta:            null,
      theta:            null,
    });

    const rowByStrike = new Map(rows.map((r) => [r.strikePrice, r]));

    const calls: any[] = [];
    const puts: any[] = [];

    for (const strike of strikes) {
      const row = rowByStrike.get(strike);
      if (row?.CE) calls.push(mapNse(row.CE, "CE"));
      if (row?.PE) puts.push(mapNse(row.PE, "PE"));
    }

    return res.json({
      symbol,
      underlyingPrice,
      expiries,
      selectedExpiry: selectedExpiryISO,
      dataSource: "NSE",
      timestamp: new Date().toISOString(),
      calls,
      puts,
    });
  } catch (nseErr) {
    req.log.warn({ err: nseErr }, "NSE options chain failed, falling back to Yahoo Finance");
  }

  // ── 2. Yahoo Finance fallback ──────────────────────────────────────────────
  try {
    const yahooSym =
      symbol === "NIFTY" ? "^NSEI"
      : symbol === "BANKNIFTY" ? "^NSEBANK"
      : toYahooSymbol(symbol);

    let underlyingPrice = 0;
    try {
      const q = await yahooFinance.quote(yahooSym);
      underlyingPrice = q.regularMarketPrice ?? 0;
    } catch { underlyingPrice = 22000; }

    let optionChain: any = null;
    try { optionChain = await yahooFinance.options(yahooSym); } catch { /* ignore */ }

    if (optionChain?.options?.length > 0) {
      const expiries = (optionChain.expirationDates ?? []).map((d: Date) => d.toISOString());
      const selectedExpiry = query.expiry || expiries[0] || "";
      const chain = optionChain.options[0];
      const mapY = (c: any, type: "CE" | "PE") => ({
        strikePrice: c.strike,
        expiry: selectedExpiry,
        type,
        ltp: c.lastPrice ?? 0,
        change: c.change ?? 0,
        changePercent: c.percentChange ?? 0,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: (c.impliedVolatility ?? 0) * 100,
        changeInOI: 0, bid: 0, ask: 0, bidQty: 0, askQty: 0,
        delta: null, theta: null,
      });
      return res.json({
        symbol, underlyingPrice, expiries, selectedExpiry,
        dataSource: "Yahoo",
        timestamp: new Date().toISOString(),
        calls: (chain.calls || []).map((c: any) => mapY(c, "CE")),
        puts:  (chain.puts  || []).map((p: any) => mapY(p, "PE")),
      });
    }

    // ── 3. Synthetic last-resort fallback ──────────────────────────────────
    const base = Math.round(underlyingPrice / 100) * 100;
    const strikes = Array.from({ length: 21 }, (_, i) => base + (i - 10) * 100);
    const expiries = [7, 14, 21].map((d) => new Date(Date.now() + d * 86400000).toISOString());
    const selectedExpiry = query.expiry || expiries[0];

    const makeSynthetic = (type: "CE" | "PE") =>
      strikes.map((strike) => {
        const diff = Math.abs(strike - underlyingPrice);
        const baseOI = Math.round(50000 + Math.random() * 200000);
        const ltp = Math.max(5, Math.round((diff * 0.4 + Math.random() * 50) * 10) / 10);
        return {
          strikePrice: strike, expiry: selectedExpiry, type,
          ltp, change: Math.round((Math.random() * 40 - 20) * 10) / 10,
          changePercent: Math.round((Math.random() * 10 - 5) * 10) / 10,
          volume: Math.round(baseOI * 0.3), openInterest: baseOI,
          impliedVolatility: Math.round((15 + Math.random() * 25) * 10) / 10,
          changeInOI: 0, bid: 0, ask: 0, bidQty: 0, askQty: 0,
          delta: null, theta: null,
        };
      });

    return res.json({
      symbol, underlyingPrice, expiries, selectedExpiry,
      dataSource: "synthetic",
      timestamp: new Date().toISOString(),
      calls: makeSynthetic("CE"),
      puts:  makeSynthetic("PE"),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch options chain");
    return res.status(500).json({ error: "Failed to fetch options chain" });
  }
});

router.get("/market/futures", async (req, res) => {
  try {
    const query = GetFuturesQueryParams.parse(req.query);

    const futuresSymbols = [
      { symbol: "NIFTY", yahooSym: "^NSEI", name: "NIFTY Futures" },
      {
        symbol: "BANKNIFTY",
        yahooSym: "^NSEBANK",
        name: "BANK NIFTY Futures",
      },
      { symbol: "RELIANCE", yahooSym: "RELIANCE.NS", name: "Reliance Futures" },
      { symbol: "TCS", yahooSym: "TCS.NS", name: "TCS Futures" },
      { symbol: "INFY", yahooSym: "INFY.NS", name: "Infosys Futures" },
    ];

    const filtered = query.symbol
      ? futuresSymbols.filter(
          (f) => f.symbol === query.symbol?.toUpperCase()
        )
      : futuresSymbols;

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + ((4 - expiry.getDay() + 7) % 7 || 7)); // Next Thursday

    const results = await Promise.all(
      filtered.map(async (f) => {
        try {
          const q = await yahooFinance.quote(f.yahooSym);
          const spot = q.regularMarketPrice ?? 0;
          // Basis is simulated as a small contango (futures typically trade above spot)
          const basisMagnitude = Math.round(spot * 0.001 * 100) / 100;
          const basis = basisMagnitude;
          // OI is simulated — no real futures OI data available from this source
          const simulatedOI = 150000 + (f.symbol.charCodeAt(0) % 10) * 35000;
          return {
            symbol: f.symbol,
            name: f.name,
            expiry: expiry.toISOString(),
            ltp: Math.round((spot + basis) * 100) / 100,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: Math.round((q.regularMarketVolume ?? 0) * 0.1),
            openInterest: simulatedOI,
            basis: Math.round(basis * 100) / 100,
          };
        } catch {
          return null;
        }
      })
    );

    res.json(results.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch futures");
    res.status(500).json({ error: "Failed to fetch futures" });
  }
});

router.get("/market/history", async (req, res) => {
  try {
    const query = GetMarketHistoryQueryParams.parse(req.query);
    const INDEX_MAP: Record<string, string> = {
      NIFTY:      "^NSEI",
      NIFTY50:    "^NSEI",
      BANKNIFTY:  "^NSEBANK",
      FINNIFTY:   "^CNXFIN",
      MIDCPNIFTY: "^NSEMDCP50",
      SENSEX:     "^BSESN",
      NIFTYMID:   "^NSEMDCP50",
      NIFTYIT:    "^CNXIT",
    };
    const yahooSym = INDEX_MAP[query.symbol.toUpperCase()] ?? toYahooSymbol(query.symbol);

    const periodMap: Record<string, string> = {
      "1d": "1d",
      "5d": "5d",
      "1mo": "1mo",
      "3mo": "3mo",
      "6mo": "6mo",
      "1y": "1y",
    };
    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "1d": "1d",
    };

    const historical = await yahooFinance.chart(yahooSym, {
      period1:
        query.period === "1d"
          ? new Date(Date.now() - 86400000)
          : query.period === "5d"
            ? new Date(Date.now() - 5 * 86400000)
            : query.period === "1mo"
              ? new Date(Date.now() - 30 * 86400000)
              : query.period === "3mo"
                ? new Date(Date.now() - 90 * 86400000)
                : query.period === "6mo"
                  ? new Date(Date.now() - 180 * 86400000)
                  : new Date(Date.now() - 365 * 86400000),
      interval: (intervalMap[query.interval ?? "1d"] || "1d") as any,
    });

    const candles =
      historical.quotes?.map((q: any) => ({
        timestamp: new Date(q.date).toISOString(),
        open: q.open ?? 0,
        high: q.high ?? 0,
        low: q.low ?? 0,
        close: q.close ?? 0,
        volume: q.volume ?? 0,
      })) ?? [];

    res.json({
      symbol: query.symbol,
      interval: query.interval || "1d",
      candles,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch history");
    res.status(500).json({ error: "Failed to fetch market history" });
  }
});

router.get("/market/movers", async (req, res) => {
  try {
    const quotes = await Promise.all(
      DEFAULT_SYMBOLS.map(async (sym) => {
        try {
          const q = await yahooFinance.quote(sym);
          const symbol = sym.replace(/\.(NS|BO)$/, "");
          const price = q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
          return {
            symbol,
            name: q.longName || q.shortName || symbol,
            exchange: sym.endsWith(".BO") ? "BSE" : "NSE",
            price,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
            open: q.regularMarketOpen ?? price,
            high: q.regularMarketDayHigh ?? price,
            low: q.regularMarketDayLow ?? price,
            previousClose: q.regularMarketPreviousClose ?? 0,
            marketCap: q.marketCap ?? null,
            timestamp: new Date().toISOString(),
          };
        } catch {
          return null;
        }
      })
    );

    const valid = quotes.filter(Boolean) as any[];
    const sortedDesc = [...valid].sort((a, b) => b.changePercent - a.changePercent);
    const sortedAsc  = [...valid].sort((a, b) => a.changePercent - b.changePercent);

    // Only include true gainers (positive %) and true losers (negative %)
    const gainers = sortedDesc.filter((q) => q.changePercent > 0).slice(0, 5);
    const losers  = sortedAsc.filter((q) => q.changePercent < 0).slice(0, 5);

    // Fallback: if no true gainers/losers (entire market moved one way),
    // show the least-negative / least-positive performers so the UI is never empty
    res.json({
      gainers: gainers.length > 0 ? gainers : sortedDesc.slice(0, 5),
      losers:  losers.length  > 0 ? losers  : sortedAsc.slice(0, 5),
      mostActive: [...valid]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch movers");
    res.status(500).json({ error: "Failed to fetch market movers" });
  }
});

// ── Symbol search ─────────────────────────────────────────────────────────────
router.get("/market/search", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ results: [] });

    const raw = await yahooFinance.search(q, { newsCount: 0 });
    const results = (raw.quotes ?? [])
      .filter((r: any) => r.exchange && (r.exchange.includes("NSE") || r.exchange.includes("BSE") || r.typeDisp === "Index"))
      .slice(0, 8)
      .map((r: any) => ({
        symbol: r.symbol?.replace(/\.NS$|\.BO$/, "") ?? r.symbol,
        yahooSymbol: r.symbol,
        name: r.longname || r.shortname || r.symbol,
        exchange: r.exchange ?? "",
        type: r.typeDisp ?? "Equity",
      }));

    return res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Symbol search failed");
    return res.status(500).json({ error: "Search failed" });
  }
});

export default router;
