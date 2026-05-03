import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ATR,
  Stochastic,
} from "technicalindicators";
import { GetTechnicalAnalysisQueryParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { watchlist } from "@workspace/db";

const router: IRouter = Router();

function toYahooSymbol(symbol: string): string {
  if (symbol.includes(".")) return symbol;
  if (symbol === "NIFTY") return "^NSEI";
  if (symbol === "BANKNIFTY") return "^NSEBANK";
  return `${symbol}.NS`;
}

function computeTrend(
  signalCount: number,
  total: number
): "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH" {
  const ratio = signalCount / total;
  if (ratio >= 0.75) return "STRONG_BULLISH";
  if (ratio >= 0.55) return "BULLISH";
  if (ratio <= 0.25) return "STRONG_BEARISH";
  if (ratio <= 0.45) return "BEARISH";
  return "NEUTRAL";
}

// Yahoo Finance data availability limits per interval
const INTERVAL_LOOKBACK_MS: Record<string, number> = {
  "1m":  7   * 86400000,
  "5m":  55  * 86400000,  // keep under 60-day limit
  "15m": 55  * 86400000,
  "1h":  180 * 86400000,
  "1d":  365 * 86400000,
};

async function computeTechnicals(symbol: string, interval: string = "1d") {
  const yahooSym = toYahooSymbol(symbol);
  const lookback = INTERVAL_LOOKBACK_MS[interval] ?? INTERVAL_LOOKBACK_MS["1d"];

  const chart = await yahooFinance.chart(yahooSym, {
    period1: new Date(Date.now() - lookback),
    interval: interval as any,
  });

  const quotes = chart.quotes ?? [];
  if (quotes.length < 20) {
    throw new Error("Insufficient data for analysis");
  }

  const closes = quotes.map((q: any) => q.close ?? 0).filter((v: number) => v > 0);
  const highs = quotes.map((q: any) => q.high ?? 0).filter((v: number) => v > 0);
  const lows = quotes.map((q: any) => q.low ?? 0).filter((v: number) => v > 0);

  // RSI (14)
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const rsi = rsiValues[rsiValues.length - 1] ?? null;

  // MACD
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const lastMacd = macdResult[macdResult.length - 1];
  const macd = lastMacd
    ? {
        macd: Math.round((lastMacd.MACD ?? 0) * 100) / 100,
        signal: Math.round((lastMacd.signal ?? 0) * 100) / 100,
        histogram: Math.round((lastMacd.histogram ?? 0) * 100) / 100,
      }
    : null;

  // Bollinger Bands (20, 2)
  const bbResult = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
  const lastBB = bbResult[bbResult.length - 1];
  const bollingerBands = lastBB
    ? {
        upper: Math.round(lastBB.upper * 100) / 100,
        middle: Math.round(lastBB.middle * 100) / 100,
        lower: Math.round(lastBB.lower * 100) / 100,
      }
    : null;

  // SMAs
  const sma20Values = SMA.calculate({ period: 20, values: closes });
  const sma50Values = SMA.calculate({ period: 50, values: closes });
  const sma200Values = SMA.calculate({ period: 200, values: closes });
  const sma20 = sma20Values[sma20Values.length - 1] ?? null;
  const sma50 = sma50Values.length ? sma50Values[sma50Values.length - 1] : null;
  const sma200 = sma200Values.length
    ? sma200Values[sma200Values.length - 1]
    : null;

  // EMAs
  const ema9Values = EMA.calculate({ period: 9, values: closes });
  const ema21Values = EMA.calculate({ period: 21, values: closes });
  const ema9 = ema9Values[ema9Values.length - 1] ?? null;
  const ema21 = ema21Values[ema21Values.length - 1] ?? null;

  // ATR (14)
  let atr: number | null = null;
  if (highs.length >= 15 && lows.length >= 15) {
    const atrValues = ATR.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes,
    });
    atr = atrValues[atrValues.length - 1] ?? null;
  }

  // Stochastic
  let stochastic: { k: number; d: number } | null = null;
  if (highs.length >= 14) {
    const stochValues = Stochastic.calculate({
      period: 14,
      signalPeriod: 3,
      high: highs,
      low: lows,
      close: closes,
    });
    const lastStoch = stochValues[stochValues.length - 1];
    if (lastStoch) {
      stochastic = {
        k: Math.round(lastStoch.k * 10) / 10,
        d: Math.round(lastStoch.d * 10) / 10,
      };
    }
  }

  // Compute overall signal
  const currentPrice = closes[closes.length - 1];
  let bullishSignals = 0;
  let totalSignals = 0;

  if (rsi !== null) {
    totalSignals++;
    if (rsi < 30) bullishSignals++; // Oversold = bullish
    else if (rsi > 70) {} // Overbought = bearish
    else if (rsi > 50) bullishSignals++;
  }

  if (macd) {
    totalSignals += 2;
    if (macd.histogram > 0) bullishSignals++;
    if (macd.macd > macd.signal) bullishSignals++;
  }

  if (sma20 && sma50) {
    totalSignals++;
    if (sma20 > sma50) bullishSignals++;
  }

  if (currentPrice && sma200) {
    totalSignals++;
    if (currentPrice > sma200) bullishSignals++;
  }

  if (ema9 && ema21) {
    totalSignals++;
    if (ema9 > ema21) bullishSignals++;
  }

  if (stochastic) {
    totalSignals++;
    if (stochastic.k < 20) bullishSignals++;
    else if (stochastic.k > 80) {} // Overbought
    else if (stochastic.k > stochastic.d) bullishSignals++;
  }

  const trend = computeTrend(bullishSignals, Math.max(totalSignals, 1));
  const signalStrength =
    Math.round((bullishSignals / Math.max(totalSignals, 1)) * 100);

  let overallSignal: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (signalStrength >= 60) overallSignal = "BUY";
  else if (signalStrength <= 40) overallSignal = "SELL";

  return {
    symbol,
    interval,
    timestamp: new Date().toISOString(),
    rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
    macd,
    bollingerBands,
    sma20: sma20 ? Math.round(sma20 * 100) / 100 : null,
    sma50: sma50 ? Math.round(sma50 * 100) / 100 : null,
    sma200: sma200 ? Math.round(sma200 * 100) / 100 : null,
    ema9: ema9 ? Math.round(ema9 * 100) / 100 : null,
    ema21: ema21 ? Math.round(ema21 * 100) / 100 : null,
    atr: atr ? Math.round(atr * 100) / 100 : null,
    stochastic,
    trend,
    overallSignal,
    signalStrength,
  };
}

router.get("/analysis/technical", async (req, res) => {
  try {
    const query = GetTechnicalAnalysisQueryParams.parse(req.query);
    const result = await computeTechnicals(query.symbol, query.interval || "1d");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to compute technical analysis");
    res.status(500).json({ error: "Failed to compute technical analysis" });
  }
});

router.get("/analysis/summary", async (req, res) => {
  try {
    const items = await db.select().from(watchlist);
    const symbols =
      items.length > 0
        ? items.map((w) => w.symbol)
        : ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK"];

    const results = await Promise.allSettled(
      symbols.slice(0, 10).map((s) => computeTechnicals(s))
    );

    let bullish = 0,
      bearish = 0,
      neutral = 0,
      strongBuy = 0,
      strongSell = 0;
    const topBuySignals: string[] = [];
    const topSellSignals: string[] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const t = r.value;
        if (t.trend.includes("BULLISH")) bullish++;
        else if (t.trend.includes("BEARISH")) bearish++;
        else neutral++;

        if (t.trend === "STRONG_BULLISH") {
          strongBuy++;
          topBuySignals.push(symbols[i]);
        }
        if (t.trend === "STRONG_BEARISH") {
          strongSell++;
          topSellSignals.push(symbols[i]);
        }
        if (t.overallSignal === "BUY" && topBuySignals.length < 5) {
          if (!topBuySignals.includes(symbols[i]))
            topBuySignals.push(symbols[i]);
        }
        if (t.overallSignal === "SELL" && topSellSignals.length < 5) {
          if (!topSellSignals.includes(symbols[i]))
            topSellSignals.push(symbols[i]);
        }
      }
    });

    res.json({
      totalSymbols: symbols.length,
      bullish,
      bearish,
      neutral,
      strongBuy,
      strongSell,
      topBuySignals: topBuySignals.slice(0, 5),
      topSellSignals: topSellSignals.slice(0, 5),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute analysis summary");
    res.status(500).json({ error: "Failed to compute analysis summary" });
  }
});

export { computeTechnicals };
export default router;
