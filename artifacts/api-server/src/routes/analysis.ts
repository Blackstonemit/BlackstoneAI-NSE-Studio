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
  ADX,
  OBV,
  VWAP,
  VolumeProfile,
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
  "5m":  55  * 86400000,
  "15m": 55  * 86400000,
  "1h":  180 * 86400000,
  "1d":  365 * 86400000,
};

// ── Custom indicator implementations ──────────────────────────────────────────

function computeAroon(
  highs: number[],
  lows: number[],
  period: number = 14
): { up: number; down: number } | null {
  if (highs.length < period + 1) return null;
  const hSlice = highs.slice(-(period + 1));
  const lSlice = lows.slice(-(period + 1));
  let highIdx = 0, lowIdx = 0;
  for (let i = 1; i <= period; i++) {
    if (hSlice[i] >= hSlice[highIdx]) highIdx = i;
    if (lSlice[i] <= lSlice[lowIdx]) lowIdx = i;
  }
  const barsSinceHigh = period - highIdx;
  const barsSinceLow = period - lowIdx;
  return {
    up:   Math.round(((period - barsSinceHigh) / period) * 100),
    down: Math.round(((period - barsSinceLow)  / period) * 100),
  };
}

function computeSuperTrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 7,
  multiplier: number = 3
): { value: number; direction: "UP" | "DOWN" } | null {
  if (highs.length < period + 2) return null;
  const atrValues = ATR.calculate({ period, high: highs, low: lows, close: closes });
  if (!atrValues.length) return null;

  const offset = highs.length - atrValues.length;
  let upperBand = 0, lowerBand = 0;
  let prevUpper = 0, prevLower = 0;
  let prevST = 0;
  let direction = 1;

  for (let i = 0; i < atrValues.length; i++) {
    const idx = offset + i;
    const mid = (highs[idx] + lows[idx]) / 2;
    const atr = atrValues[i];
    const basicUpper = mid + multiplier * atr;
    const basicLower = mid - multiplier * atr;

    const curUpper = (i === 0 || basicUpper < prevUpper || closes[idx - 1] > prevUpper)
      ? basicUpper : prevUpper;
    const curLower = (i === 0 || basicLower > prevLower || closes[idx - 1] < prevLower)
      ? basicLower : prevLower;

    if (i === 0) {
      direction = 1;
      prevST = curLower;
    } else if (prevST === prevUpper) {
      direction = closes[idx] > curUpper ? 1 : -1;
    } else {
      direction = closes[idx] < curLower ? -1 : 1;
    }

    prevST = direction === 1 ? curLower : curUpper;
    prevUpper = curUpper;
    prevLower = curLower;
  }

  return {
    value: Math.round(prevST * 100) / 100,
    direction: direction === 1 ? "UP" : "DOWN",
  };
}

function computeFibonacci(
  highs: number[],
  lows: number[],
  period: number = 50
): { high: number; low: number; r236: number; r382: number; r500: number; r618: number; r786: number } | null {
  if (highs.length < 10) return null;
  const hSlice = highs.slice(-period);
  const lSlice = lows.slice(-period);
  const hi  = Math.max(...hSlice);
  const lo  = Math.min(...lSlice);
  const diff = hi - lo;
  const r = (pct: number) => Math.round((hi - pct * diff) * 100) / 100;
  return {
    high: Math.round(hi * 100) / 100,
    low:  Math.round(lo * 100) / 100,
    r236: r(0.236),
    r382: r(0.382),
    r500: r(0.500),
    r618: r(0.618),
    r786: r(0.786),
  };
}

function computeSTC(closes: number[], fast: number = 23, slow: number = 50, period: number = 10): number | null {
  if (closes.length < slow + period + 6) return null;

  // Step 1: MACD line (fast EMA - slow EMA)
  const fastEMA = EMA.calculate({ period: fast, values: closes });
  const slowEMA = EMA.calculate({ period: slow, values: closes });
  const minLen = Math.min(fastEMA.length, slowEMA.length);
  const macdLine: number[] = [];
  for (let i = 0; i < minLen; i++) {
    macdLine.push(fastEMA[fastEMA.length - minLen + i] - slowEMA[slowEMA.length - minLen + i]);
  }
  if (macdLine.length < period) return null;

  // Step 2: Stochastic of MACD
  const stoch1 = rollingStoch(macdLine, period);
  if (stoch1.length < 3) return null;

  // Step 3: Smooth stoch1 with EMA(3)
  const smooth1 = EMA.calculate({ period: 3, values: stoch1 });
  if (smooth1.length < period) return null;

  // Step 4: Stochastic of smoothed
  const stoch2 = rollingStoch(smooth1, period);
  if (stoch2.length < 3) return null;

  // Step 5: Smooth again
  const smooth2 = EMA.calculate({ period: 3, values: stoch2 });
  if (!smooth2.length) return null;

  return Math.round(smooth2[smooth2.length - 1] * 10) / 10;
}

function rollingStoch(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const hi = Math.max(...slice);
    const lo = Math.min(...slice);
    const range = hi - lo;
    result.push(range === 0 ? 50 : ((values[i] - lo) / range) * 100);
  }
  return result;
}

function computeKlinger(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[]
): { kvo: number; signal: number } | null {
  if (closes.length < 60 || volumes.every(v => v === 0)) return null;

  const hlc = closes.map((c, i) => c + highs[i] + lows[i]);
  const vf: number[] = [];
  let cm = 0;

  for (let i = 1; i < closes.length; i++) {
    const trend = hlc[i] >= hlc[i - 1] ? 1 : -1;
    const dm = highs[i] - lows[i];
    const prevDm = highs[i - 1] - lows[i - 1];
    cm = trend > 0 ? (cm + dm) : (dm + prevDm);
    const vforce = cm === 0 ? 0 : volumes[i] * Math.abs(2 * (dm / cm) - 1) * trend * 100;
    vf.push(vforce);
  }

  if (vf.length < 55) return null;

  const kvo34 = EMA.calculate({ period: 34, values: vf });
  const kvo55 = EMA.calculate({ period: 55, values: vf });
  if (!kvo34.length || !kvo55.length) return null;

  const minLen2 = Math.min(kvo34.length, kvo55.length);
  const kvoLine: number[] = [];
  for (let i = 0; i < minLen2; i++) {
    kvoLine.push(kvo34[kvo34.length - minLen2 + i] - kvo55[kvo55.length - minLen2 + i]);
  }

  if (kvoLine.length < 13) return null;
  const sig = EMA.calculate({ period: 13, values: kvoLine });
  if (!sig.length) return null;

  return {
    kvo:    Math.round(kvoLine[kvoLine.length - 1]),
    signal: Math.round(sig[sig.length - 1]),
  };
}

// ──────────────────────────────────────────────────────────────────────────────

async function computeTechnicals(symbol: string, interval: string = "1d") {
  const yahooSym = toYahooSymbol(symbol);
  const lookback = INTERVAL_LOOKBACK_MS[interval] ?? INTERVAL_LOOKBACK_MS["1d"];

  // Fetch price data + INDIAVIX in parallel
  const [chart, vixChart] = await Promise.allSettled([
    yahooFinance.chart(yahooSym, {
      period1: new Date(Date.now() - lookback),
      interval: interval as any,
    }),
    yahooFinance.chart("^INDIAVIX", {
      period1: new Date(Date.now() - 7 * 86400000),
      interval: "1d" as any,
    }),
  ]);

  if (chart.status === "rejected") throw chart.reason;
  const quotes = chart.value.quotes ?? [];
  if (quotes.length < 20) throw new Error("Insufficient data for analysis");

  const validQuotes = quotes.filter(
    (q: any) => (q.close ?? 0) > 0 && (q.high ?? 0) > 0 && (q.low ?? 0) > 0
  );
  const closes  = validQuotes.map((q: any) => q.close  as number);
  const highs   = validQuotes.map((q: any) => q.high   as number);
  const lows    = validQuotes.map((q: any) => q.low    as number);
  const opens   = validQuotes.map((q: any) => (q.open ?? q.close) as number);
  const volumes = validQuotes.map((q: any) => (q.volume ?? 0) as number);

  // ── Existing indicators ───────────────────────────────────────────────────

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
        macd:      Math.round((lastMacd.MACD      ?? 0) * 100) / 100,
        signal:    Math.round((lastMacd.signal    ?? 0) * 100) / 100,
        histogram: Math.round((lastMacd.histogram ?? 0) * 100) / 100,
      }
    : null;

  // Bollinger Bands (20, 2)
  const bbResult = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const lastBB = bbResult[bbResult.length - 1];
  const bollingerBands = lastBB
    ? {
        upper:  Math.round(lastBB.upper  * 100) / 100,
        middle: Math.round(lastBB.middle * 100) / 100,
        lower:  Math.round(lastBB.lower  * 100) / 100,
      }
    : null;

  // SMAs
  const sma20Values  = SMA.calculate({ period: 20,  values: closes });
  const sma50Values  = SMA.calculate({ period: 50,  values: closes });
  const sma200Values = SMA.calculate({ period: 200, values: closes });
  const sma20  = sma20Values[sma20Values.length - 1]   ?? null;
  const sma50  = sma50Values.length  ? sma50Values[sma50Values.length - 1]   : null;
  const sma200 = sma200Values.length ? sma200Values[sma200Values.length - 1] : null;

  // EMAs
  const ema9Values  = EMA.calculate({ period: 9,  values: closes });
  const ema21Values = EMA.calculate({ period: 21, values: closes });
  const ema9  = ema9Values[ema9Values.length - 1]   ?? null;
  const ema21 = ema21Values[ema21Values.length - 1] ?? null;

  // ATR (14)
  let atr: number | null = null;
  if (highs.length >= 15) {
    const atrValues = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
    atr = atrValues[atrValues.length - 1] ?? null;
  }

  // Stochastic
  let stochastic: { k: number; d: number } | null = null;
  if (highs.length >= 14) {
    const stochValues = Stochastic.calculate({
      period: 14, signalPeriod: 3, high: highs, low: lows, close: closes,
    });
    const lastStoch = stochValues[stochValues.length - 1];
    if (lastStoch) {
      stochastic = {
        k: Math.round(lastStoch.k * 10) / 10,
        d: Math.round(lastStoch.d * 10) / 10,
      };
    }
  }

  // ── New advanced indicators ────────────────────────────────────────────────

  // ADX (14)
  let adx: number | null = null;
  if (highs.length >= 15) {
    try {
      const adxResult = ADX.calculate({ period: 14, close: closes, high: highs, low: lows });
      const last = adxResult[adxResult.length - 1] as any;
      if (last?.adx != null) adx = Math.round(last.adx * 10) / 10;
    } catch { /* ignore */ }
  }

  // OBV
  const hasVolume = volumes.some((v: number) => v > 0);
  let obv: number | null = null;
  if (hasVolume) {
    try {
      const obvResult = OBV.calculate({ close: closes, volume: volumes });
      const lastObv = obvResult[obvResult.length - 1];
      if (lastObv != null) obv = Math.round(lastObv);
    } catch { /* ignore */ }
  }

  // VWAP
  let vwap: number | null = null;
  if (hasVolume) {
    try {
      const vwapResult = VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });
      const lastVwap = vwapResult[vwapResult.length - 1];
      if (lastVwap != null) vwap = Math.round(lastVwap * 100) / 100;
    } catch { /* ignore */ }
  }

  // Session POC (Point of Control via VolumeProfile)
  let sessionPOC: number | null = null;
  if (hasVolume && opens.length >= 14) {
    try {
      const vpResult = VolumeProfile.calculate({
        open: opens, high: highs, low: lows, close: closes,
        volume: volumes, noOfBars: 14,
      });
      if (vpResult.length > 0) {
        const poc = (vpResult as any[]).reduce((a, b) =>
          (a.volumeProfile ?? 0) > (b.volumeProfile ?? 0) ? a : b
        );
        sessionPOC = Math.round(((poc.rangeHigh + poc.rangeLow) / 2) * 100) / 100;
      }
    } catch { /* ignore */ }
  }

  // SuperTrend (7, 3)
  const superTrend = computeSuperTrend(highs, lows, closes);

  // Fibonacci Retracements (50-bar lookback)
  const fibonacci = computeFibonacci(highs, lows);

  // INDIAVIX
  let indiaVix: number | null = null;
  if (vixChart.status === "fulfilled") {
    const vixQuotes = (vixChart.value.quotes ?? []).filter((q: any) => (q.close ?? 0) > 0);
    const lastVix = vixQuotes[vixQuotes.length - 1] as any;
    if (lastVix?.close) indiaVix = Math.round(lastVix.close * 100) / 100;
  }

  // Aroon (14)
  const aroon = computeAroon(highs, lows);

  // STC (Schaff Trend Cycle: 23, 50, 10)
  const stc = computeSTC(closes);

  // Klinger Volume Oscillator
  const klinger = computeKlinger(closes, highs, lows, volumes);

  // ── Overall signal computation ─────────────────────────────────────────────

  const currentPrice = closes[closes.length - 1];
  let bullishSignals = 0;
  let totalSignals = 0;

  if (rsi !== null) {
    totalSignals++;
    if (rsi < 30) bullishSignals++;
    else if (rsi <= 70 && rsi > 50) bullishSignals++;
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
    else if (stochastic.k <= 80 && stochastic.k > stochastic.d) bullishSignals++;
  }
  if (superTrend) {
    totalSignals++;
    if (superTrend.direction === "UP") bullishSignals++;
  }
  if (aroon) {
    totalSignals++;
    if (aroon.up > aroon.down) bullishSignals++;
  }
  if (stc !== null) {
    totalSignals++;
    if (stc > 50) bullishSignals++;
  }
  if (klinger) {
    totalSignals++;
    if (klinger.kvo > klinger.signal) bullishSignals++;
  }

  const trend = computeTrend(bullishSignals, Math.max(totalSignals, 1));
  const signalStrength = Math.round((bullishSignals / Math.max(totalSignals, 1)) * 100);

  let overallSignal: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (signalStrength >= 60) overallSignal = "BUY";
  else if (signalStrength <= 40) overallSignal = "SELL";

  return {
    symbol,
    interval,
    timestamp: new Date().toISOString(),
    rsi:            rsi !== null ? Math.round(rsi * 10) / 10 : null,
    macd,
    bollingerBands,
    sma20:          sma20  ? Math.round(sma20  * 100) / 100 : null,
    sma50:          sma50  ? Math.round(sma50  * 100) / 100 : null,
    sma200:         sma200 ? Math.round(sma200 * 100) / 100 : null,
    ema9:           ema9   ? Math.round(ema9   * 100) / 100 : null,
    ema21:          ema21  ? Math.round(ema21  * 100) / 100 : null,
    atr:            atr    ? Math.round(atr    * 100) / 100 : null,
    stochastic,
    adx,
    obv,
    vwap,
    superTrend,
    fibonacci,
    indiaVix,
    sessionPOC,
    aroon,
    stc,
    klinger,
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

    let bullish = 0, bearish = 0, neutral = 0, strongBuy = 0, strongSell = 0;
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
        if (t.overallSignal === "BUY" && !topBuySignals.includes(symbols[i]) && topBuySignals.length < 5) {
          topBuySignals.push(symbols[i]);
        }
        if (t.overallSignal === "SELL" && !topSellSignals.includes(symbols[i]) && topSellSignals.length < 5) {
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
      topBuySignals:  topBuySignals.slice(0, 5),
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
