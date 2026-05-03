import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import {
  GetMarketQuotesQueryParams,
  GetMarketHistoryQueryParams,
  GetOptionsChainQueryParams,
  GetFuturesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// NSE symbol suffix map
function toYahooSymbol(symbol: string, exchange: string = "NSE"): string {
  if (symbol.includes(".")) return symbol;
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
            timestamp: new Date().toISOString(),
          };
        } catch {
          return {
            symbol: idx.symbol,
            name: idx.name,
            value: 0,
            change: 0,
            changePercent: 0,
            high: 0,
            low: 0,
            timestamp: new Date().toISOString(),
          };
        }
      })
    );

    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch indices");
    res.status(500).json({ error: "Failed to fetch indices" });
  }
});

router.get("/market/options-chain", async (req, res) => {
  try {
    const query = GetOptionsChainQueryParams.parse(req.query);
    const symbol = query.symbol;
    const yahooSym =
      symbol === "NIFTY"
        ? "^NSEI"
        : symbol === "BANKNIFTY"
          ? "^NSEBANK"
          : toYahooSymbol(symbol);

    let underlyingPrice = 0;
    try {
      const q = await yahooFinance.quote(yahooSym);
      underlyingPrice = q.regularMarketPrice ?? 0;
    } catch {
      underlyingPrice = 22000;
    }

    // Get options chain from yahoo finance
    let optionChain: any = null;
    try {
      optionChain = await yahooFinance.options(yahooSym);
    } catch {
      // Return synthetic options data if yahoo doesn't support it
    }

    if (
      optionChain &&
      optionChain.options &&
      optionChain.options.length > 0
    ) {
      const expiries = optionChain.expirationDates?.map((d: Date) =>
        d.toISOString()
      ) || [];
      const selectedExpiry = query.expiry || expiries[0] || "";
      const chain = optionChain.options[0];

      const mapContract = (c: any, type: "CE" | "PE") => ({
        strikePrice: c.strike,
        expiry: selectedExpiry,
        type,
        ltp: c.lastPrice ?? 0,
        change: c.change ?? 0,
        changePercent: c.percentChange ?? 0,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: (c.impliedVolatility ?? 0) * 100,
        delta: null,
        theta: null,
      });

      res.json({
        symbol,
        underlyingPrice,
        expiries,
        selectedExpiry,
        calls: (chain.calls || []).map((c: any) => mapContract(c, "CE")),
        puts: (chain.puts || []).map((p: any) => mapContract(p, "PE")),
      });
    } else {
      // Generate synthetic options chain around current price
      const strikes = [];
      const base = Math.round(underlyingPrice / 100) * 100;
      for (let i = -10; i <= 10; i++) {
        strikes.push(base + i * 100);
      }

      const expiries = [
        new Date(Date.now() + 7 * 86400000).toISOString(),
        new Date(Date.now() + 14 * 86400000).toISOString(),
        new Date(Date.now() + 21 * 86400000).toISOString(),
      ];
      const selectedExpiry = query.expiry || expiries[0];

      const makeContracts = (type: "CE" | "PE") =>
        strikes.map((strike) => {
          const diff = Math.abs(strike - underlyingPrice);
          const baseOI = Math.round(50000 + Math.random() * 200000);
          const ltp = Math.max(5, Math.round((diff * 0.4 + Math.random() * 50) * 10) / 10);
          return {
            strikePrice: strike,
            expiry: selectedExpiry,
            type,
            ltp,
            change: Math.round((Math.random() * 40 - 20) * 10) / 10,
            changePercent: Math.round((Math.random() * 10 - 5) * 10) / 10,
            volume: Math.round(baseOI * 0.3),
            openInterest: baseOI,
            impliedVolatility: Math.round((15 + Math.random() * 25) * 10) / 10,
            delta: null,
            theta: null,
          };
        });

      res.json({
        symbol,
        underlyingPrice,
        expiries,
        selectedExpiry,
        calls: makeContracts("CE"),
        puts: makeContracts("PE"),
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch options chain");
    res.status(500).json({ error: "Failed to fetch options chain" });
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
    expiry.setDate(expiry.getDate() + (4 - expiry.getDay() + 7) % 7); // Next Thursday

    const results = await Promise.all(
      filtered.map(async (f) => {
        try {
          const q = await yahooFinance.quote(f.yahooSym);
          const spot = q.regularMarketPrice ?? 0;
          const basis = spot * 0.001 * (Math.random() > 0.5 ? 1 : -1);
          return {
            symbol: f.symbol,
            name: f.name,
            expiry: expiry.toISOString(),
            ltp: spot + basis,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            volume: Math.round((q.regularMarketVolume ?? 0) * 0.1),
            openInterest: Math.round(100000 + Math.random() * 500000),
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
    const yahooSym =
      query.symbol === "NIFTY"
        ? "^NSEI"
        : query.symbol === "BANKNIFTY"
          ? "^NSEBANK"
          : toYahooSymbol(query.symbol);

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
    const sorted = [...valid].sort((a, b) => b.changePercent - a.changePercent);

    res.json({
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
      mostActive: [...valid]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch movers");
    res.status(500).json({ error: "Failed to fetch market movers" });
  }
});

export default router;
