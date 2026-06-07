import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useGetMarketHistory,
  useGetOptionsChain,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { cn } from "@/lib/utils";
import { formatISTTime } from "@/lib/market-hours";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Activity,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type OptionContract = {
  strikePrice: number; expiry: string; type: string;
  ltp: number; change: number; changePercent: number;
  volume: number; openInterest: number; impliedVolatility: number;
};

// ── IST offset ───────────────────────────────────────────────────────────────
const IST_OFFSET_S = 19800;

// ── Symbol presets ────────────────────────────────────────────────────────────
type Preset = { label: string; apiSymbol: string; tag: string; optSymbol: string };

const PRESETS: Preset[] = [
  { label: "NIFTY 50",  apiSymbol: "NIFTY",    tag: "IDX", optSymbol: "NIFTY" },
  { label: "BANKNIFTY", apiSymbol: "BANKNIFTY", tag: "IDX", optSymbol: "BANKNIFTY" },
  { label: "FINNIFTY",  apiSymbol: "FINNIFTY",  tag: "IDX", optSymbol: "FINNIFTY" },
  { label: "RELIANCE",  apiSymbol: "RELIANCE",  tag: "STK", optSymbol: "RELIANCE" },
  { label: "HDFCBANK",  apiSymbol: "HDFCBANK",  tag: "STK", optSymbol: "HDFCBANK" },
  { label: "TCS",       apiSymbol: "TCS",       tag: "STK", optSymbol: "TCS" },
  { label: "SBIN",      apiSymbol: "SBIN",      tag: "STK", optSymbol: "SBIN" },
  { label: "INFY",      apiSymbol: "INFY",      tag: "STK", optSymbol: "INFY" },
];

// ── Chart colors ──────────────────────────────────────────────────────────────
const C = {
  bg:      "#0a0a0a",
  grid:    "#161616",
  border:  "#2a2a2a",
  text:    "#777",
  up:      "#22c55e",
  down:    "#ef4444",
  upBg:    "rgba(34,197,94,0.12)",
  downBg:  "rgba(239,68,68,0.12)",
  ema9:    "#818cf8",
  ema21:   "#f59e0b",
  vwap:    "#22d3ee",
  vol:     "rgba(100,116,139,0.5)",
  rsi:     "#22d3ee",
  macd:    "#818cf8",
  macdSig: "#f59e0b",
  macdHist:"rgba(100,116,139,0.7)",
};

const CHART_OPTS = {
  layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
  localization: {
    timeFormatter: (utcSec: number) => {
      const ist = new Date((utcSec - IST_OFFSET_S) * 1000 + IST_OFFSET_S * 1000);
      const h = ist.getUTCHours().toString().padStart(2, "0");
      const m = ist.getUTCMinutes().toString().padStart(2, "0");
      const d = ist.getUTCDate().toString().padStart(2, "0");
      const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][ist.getUTCMonth()];
      return `${d} ${mon} ${h}:${m} IST`;
    },
  },
};

// ── Technical indicator calculations ─────────────────────────────────────────

function calcEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = new Array(data.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    if (ema === null) {
      ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    out[i] = ema;
  }
  return out;
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  if (period < closes.length) {
    result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
      result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return result;
}

function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? ema12[i]! - ema26[i]! : null
  );
  const macdVals = macdLine.filter((v) => v !== null) as number[];
  const tempSignal = calcEMA(macdVals, 9);
  let sigIdx = 0;
  const signalLine: (number | null)[] = macdLine.map((v) =>
    v !== null ? (tempSignal[sigIdx++] ?? null) : null
  );
  const histogram = macdLine.map((m, i) =>
    m !== null && signalLine[i] !== null ? m - signalLine[i]! : null
  );
  return { macdLine, signalLine, histogram };
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14, smooth = 3) {
  const k: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    k[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  // %D = SMA(smooth) of %K
  const d: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1 + smooth - 1; i < closes.length; i++) {
    const slice = k.slice(i - smooth + 1, i + 1).filter((v) => v !== null) as number[];
    if (slice.length === smooth) d[i] = slice.reduce((a, b) => a + b, 0) / smooth;
  }
  return { k, d };
}

function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): (number | null)[] {
  let cumTP = 0, cumVol = 0;
  return closes.map((c, i) => {
    const tp = (highs[i] + lows[i] + c) / 3;
    cumTP += tp * volumes[i];
    cumVol += volumes[i];
    return cumVol > 0 ? cumTP / cumVol : null;
  });
}

function calcATR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const tr: number[] = closes.map((c, i) => {
    if (i === 0) return highs[i] - lows[i];
    return Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  });
  const atr: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < period && i < tr.length; i++) sum += tr[i];
  if (period <= closes.length) {
    atr[period - 1] = sum / period;
    for (let i = period; i < closes.length; i++) {
      atr[i] = (atr[i - 1]! * (period - 1) + tr[i]) / period;
    }
  }
  return atr;
}

// ── Scalp signal engine ───────────────────────────────────────────────────────
type SignalBias = "BULLISH" | "BEARISH" | "NEUTRAL";

interface ScalpIndicators {
  close: number;
  ema9: number | null;
  ema21: number | null;
  vwap: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  stochK: number | null;
  stochD: number | null;
  atr: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbMid: number | null;
}

function calcBB(closes: number[], period = 20, mult = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return { upper: null, mid: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    return { upper: mean + mult * sd, mid: mean, lower: mean - mult * sd };
  });
}

function scoreIndicators(ind: ScalpIndicators): { score: number; rows: { label: string; value: string; bias: SignalBias }[] } {
  const rows: { label: string; value: string; bias: SignalBias }[] = [];
  let score = 0;

  // 1. EMA alignment
  if (ind.ema9 !== null && ind.ema21 !== null) {
    const emaUp = ind.close > ind.ema9 && ind.ema9 > ind.ema21;
    const emaDown = ind.close < ind.ema9 && ind.ema9 < ind.ema21;
    const bias: SignalBias = emaUp ? "BULLISH" : emaDown ? "BEARISH" : "NEUTRAL";
    if (emaUp) score += 1; else if (emaDown) score -= 1;
    rows.push({ label: "EMA 9/21", value: `${ind.ema9.toFixed(1)} / ${ind.ema21.toFixed(1)}`, bias });
  }

  // 2. VWAP
  if (ind.vwap !== null) {
    const above = ind.close > ind.vwap;
    const bias: SignalBias = above ? "BULLISH" : "BEARISH";
    score += above ? 1 : -1;
    rows.push({ label: "VWAP", value: ind.vwap.toFixed(1), bias });
  }

  // 3. RSI
  if (ind.rsi !== null) {
    const rsi = ind.rsi;
    let bias: SignalBias = "NEUTRAL";
    let d = 0;
    if (rsi > 55 && rsi < 70) { bias = "BULLISH"; d = 1; }
    else if (rsi < 45 && rsi > 30) { bias = "BEARISH"; d = -1; }
    else if (rsi >= 70) { bias = "BEARISH"; d = -1; }
    else if (rsi <= 30) { bias = "BULLISH"; d = 1; }
    score += d;
    rows.push({ label: "RSI 14", value: rsi.toFixed(1), bias });
  }

  // 4. MACD
  if (ind.macd !== null && ind.macdSignal !== null) {
    const bullish = ind.macd > ind.macdSignal;
    const bias: SignalBias = bullish ? "BULLISH" : "BEARISH";
    score += bullish ? 1 : -1;
    rows.push({ label: "MACD", value: `${ind.macd.toFixed(2)} / ${ind.macdSignal.toFixed(2)}`, bias });
  }

  // 5. Stochastic
  if (ind.stochK !== null && ind.stochD !== null) {
    let bias: SignalBias = "NEUTRAL";
    let d = 0;
    if (ind.stochK < 25) { bias = "BULLISH"; d = 1; }
    else if (ind.stochK > 75) { bias = "BEARISH"; d = -1; }
    score += d;
    rows.push({ label: "Stoch %K/%D", value: `${ind.stochK.toFixed(0)} / ${ind.stochD.toFixed(0)}`, bias });
  }

  // 6. Bollinger Band position
  if (ind.bbUpper !== null && ind.bbLower !== null && ind.bbMid !== null) {
    const pct = (ind.close - ind.bbLower) / (ind.bbUpper - ind.bbLower);
    let bias: SignalBias = "NEUTRAL";
    let d = 0;
    if (pct < 0.2) { bias = "BULLISH"; d = 1; }
    else if (pct > 0.8) { bias = "BEARISH"; d = -1; }
    score += d;
    const pos = pct < 0.33 ? "LOWER BAND" : pct > 0.67 ? "UPPER BAND" : "MID BAND";
    rows.push({ label: "Bollinger", value: pos, bias });
  }

  return { score, rows };
}

function getOverallSignal(score: number): { label: string; color: string; icon: typeof TrendingUp } {
  if (score >= 3) return { label: "BUY", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10", icon: TrendingUp };
  if (score <= -3) return { label: "SELL", color: "text-red-400 border-red-400/40 bg-red-400/10", icon: TrendingDown };
  return { label: "NEUTRAL", color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: Minus };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ScalpingPage() {
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [showMACD, setShowMACD] = useState(true);

  const { data: history, isLoading, refetch } = useGetMarketHistory(
    { symbol: preset.apiSymbol, interval: "5m", period: "1d" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { staleTime: 30_000, refetchInterval: 30_000 } as any }
  );

  const { data: chain } = useGetOptionsChain(
    { symbol: preset.optSymbol },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { staleTime: 60_000 } as any }
  );

  const { isMarketOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => refetch(),
  });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mainRef  = useRef<HTMLDivElement>(null);
  const macdRef  = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const macdChart = useRef<IChartApi | null>(null);

  // ── Processed data ────────────────────────────────────────────────────────
  const processed = useMemo(() => {
    if (!history?.candles.length) return null;
    const candles = history.candles.filter(
      (c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
    );
    if (candles.length < 5) return null;

    const times  = candles.map((c) => (Math.floor(new Date(c.timestamp).getTime() / 1000) + IST_OFFSET_S) as UTCTimestamp);
    const closes = candles.map((c) => c.close);
    const highs  = candles.map((c) => c.high);
    const lows   = candles.map((c) => c.low);
    const vols   = candles.map((c) => c.volume);

    const ohlc: CandlestickData[] = candles.map((c, i) => ({
      time: times[i], open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    const volume: HistogramData[] = candles.map((c, i) => ({
      time: times[i], value: c.volume, color: c.close >= c.open ? C.upBg : C.downBg,
    }));

    const ema9raw  = calcEMA(closes, 9);
    const ema21raw = calcEMA(closes, 21);
    const vwapRaw  = calcVWAP(highs, lows, closes, vols);
    const rsiRaw   = calcRSI(closes);
    const macdRaw  = calcMACD(closes);
    const stochRaw = calcStochastic(highs, lows, closes);
    const atrRaw   = calcATR(highs, lows, closes);
    const bbRaw    = calcBB(closes);

    const toLine = (arr: (number | null)[]): LineData[] =>
      arr.map((v, i) => v !== null ? { time: times[i], value: v } : null).filter(Boolean) as LineData[];

    const macdHistData: HistogramData[] = macdRaw.histogram
      .map((v, i) => v !== null ? {
        time: times[i],
        value: v,
        color: v >= 0 ? "rgba(34,197,94,0.7)" : "rgba(239,68,68,0.7)",
      } : null)
      .filter(Boolean) as HistogramData[];

    // Last values for signal panel
    const last = candles[candles.length - 1];
    const lastIdx = candles.length - 1;
    const bb = bbRaw[lastIdx];

    const indicators: ScalpIndicators = {
      close:       last.close,
      ema9:        ema9raw[lastIdx] ?? null,
      ema21:       ema21raw[lastIdx] ?? null,
      vwap:        vwapRaw[lastIdx] ?? null,
      rsi:         rsiRaw[lastIdx] ?? null,
      macd:        macdRaw.macdLine[lastIdx] ?? null,
      macdSignal:  macdRaw.signalLine[lastIdx] ?? null,
      stochK:      stochRaw.k[lastIdx] ?? null,
      stochD:      stochRaw.d[lastIdx] ?? null,
      atr:         atrRaw[lastIdx] ?? null,
      bbUpper:     bb.upper,
      bbLower:     bb.lower,
      bbMid:       bb.mid,
    };

    const prev = candles[candles.length - 2];
    const chg = prev ? last.close - prev.close : 0;
    const chgPct = prev ? (chg / prev.close) * 100 : 0;

    return {
      ohlc, volume,
      ema9Line:  toLine(ema9raw),
      ema21Line: toLine(ema21raw),
      vwapLine:  toLine(vwapRaw),
      rsiLine:   toLine(rsiRaw),
      macdLine:  toLine(macdRaw.macdLine),
      sigLine:   toLine(macdRaw.signalLine),
      macdHistData,
      indicators,
      last, chg, chgPct,
      n: candles.length,
    };
  }, [history]);

  // ── Scalp signal ──────────────────────────────────────────────────────────
  const signal = useMemo(() => {
    if (!processed) return null;
    return scoreIndicators(processed.indicators);
  }, [processed]);

  const overall = signal ? getOverallSignal(signal.score) : null;

  // ── Build charts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !processed) return;
    mainChart.current?.remove();
    macdChart.current?.remove();
    mainChart.current = null;
    macdChart.current = null;

    const mc = createChart(mainRef.current, {
      ...CHART_OPTS,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });
    mainChart.current = mc;

    const cs = mc.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down,
      borderUpColor: C.up, borderDownColor: C.down,
      wickUpColor: C.up, wickDownColor: C.down,
    });
    cs.setData(processed.ohlc);

    const e9 = mc.addSeries(LineSeries, { color: C.ema9, lineWidth: 1, title: "EMA 9" });
    e9.setData(processed.ema9Line);

    const e21 = mc.addSeries(LineSeries, { color: C.ema21, lineWidth: 1, title: "EMA 21" });
    e21.setData(processed.ema21Line);

    const vw = mc.addSeries(LineSeries, { color: C.vwap, lineWidth: 1, lineStyle: 3, title: "VWAP" });
    vw.setData(processed.vwapLine);

    const vs = mc.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    mc.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vs.setData(processed.volume);

    mc.timeScale().fitContent();

    // MACD sub-chart
    if (showMACD && macdRef.current) {
      const rc = createChart(macdRef.current, {
        ...CHART_OPTS,
        width: macdRef.current.clientWidth,
        height: macdRef.current.clientHeight,
        timeScale: { ...CHART_OPTS.timeScale, visible: false },
      });
      macdChart.current = rc;

      const hist = rc.addSeries(HistogramSeries, { priceScaleId: "right" });
      hist.setData(processed.macdHistData);

      const ml = rc.addSeries(LineSeries, { color: C.macd, lineWidth: 1, title: "MACD" });
      ml.setData(processed.macdLine);

      const sl = rc.addSeries(LineSeries, { color: C.macdSig, lineWidth: 1, lineStyle: 2, title: "Signal" });
      sl.setData(processed.sigLine);

      rc.timeScale().fitContent();

      mc.subscribeCrosshairMove((p) => {
        if (!p.time) return;
        rc.setCrosshairPosition(0, p.time as UTCTimestamp, ml);
      });
    }

    const ro = new ResizeObserver(() => {
      if (mainRef.current) mc.applyOptions({ width: mainRef.current.clientWidth, height: mainRef.current.clientHeight });
      if (macdRef.current && macdChart.current) macdChart.current.applyOptions({ width: macdRef.current.clientWidth, height: macdRef.current.clientHeight });
    });
    mainRef.current && ro.observe(mainRef.current);
    macdRef.current && ro.observe(macdRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove(); mainChart.current = null;
      macdChart.current?.remove(); macdChart.current = null;
    };
  }, [processed, showMACD]);

  // ── Search (reuse same pattern as charts.tsx) ─────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; exchange: string; type: string; yahooSymbol: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(val), 280);
  };

  const selectResult = (r: { symbol: string; name: string; type: string }) => {
    setPreset({ label: r.symbol, apiSymbol: r.symbol, optSymbol: r.symbol, tag: r.type === "Index" ? "IDX" : "STK" });
    setSearchQuery(""); setSearchOpen(false); setSearchResults([]);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Options snapshot ──────────────────────────────────────────────────────
  const optSnap = useMemo(() => {
    if (!chain) return null;
    const ce: OptionContract[] = (chain.calls ?? []).slice().sort((a, b) => b.openInterest - a.openInterest);
    const pe: OptionContract[] = (chain.puts  ?? []).slice().sort((a, b) => b.openInterest - a.openInterest);
    const all: OptionContract[] = [...chain.calls, ...chain.puts];
    const totalCE = ce.reduce((s, c) => s + c.openInterest, 0);
    const totalPE = pe.reduce((s, c) => s + c.openInterest, 0);
    const pcr = totalCE > 0 ? totalPE / totalCE : 0;
    const maxPainStrike = (() => {
      const strikes = [...new Set(all.map((c) => c.strikePrice))].sort((a, b) => a - b);
      let minPain = Infinity, pain = 0;
      for (const s of strikes) {
        let p = 0;
        for (const c of all) {
          if (c.type === "CE") p += Math.max(0, c.strikePrice - s) * c.openInterest;
          else p += Math.max(0, s - c.strikePrice) * c.openInterest;
        }
        if (p < minPain) { minPain = p; pain = s; }
      }
      return pain;
    })();
    return { topCE: ce.slice(0, 4), topPE: pe.slice(0, 4), pcr, maxPainStrike, totalCE, totalPE };
  }, [chain]);

  const last = processed?.last;
  const chg  = processed?.chg ?? 0;

  return (
    <div className="flex flex-col -m-6 overflow-hidden" style={{ height: "calc(100vh - 0px)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[#1c1c1c] bg-[#0d0d0d]">
        <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">

          <div className="flex items-center gap-1.5 mr-1 font-mono text-xs font-bold text-primary">
            <Zap className="h-3.5 w-3.5" />
            SCALP DESK · 5M
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.apiSymbol}
                onClick={() => setPreset(p)}
                className={cn(
                  "px-2 py-0.5 text-[11px] font-mono border rounded-sm transition-colors flex items-center gap-1",
                  preset.apiSymbol === p.apiSymbol
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-[#aaa]"
                )}
              >
                {p.label}
                <span className="text-[8px] text-[#444]">{p.tag}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div ref={searchRef} className="relative ml-1">
            <div className="flex items-center border border-[#2a2a2a] rounded-sm bg-[#111] focus-within:border-primary transition-colors">
              <span className="pl-1.5 text-[#444]">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                value={searchQuery}
                onChange={onSearchChange}
                onFocus={() => { if (searchQuery) setSearchOpen(true); }}
                placeholder="Search…"
                className="w-24 h-6 px-1.5 text-[11px] font-mono bg-transparent text-[#aaa] placeholder:text-[#444] focus:outline-none"
              />
              {searchLoading && <span className="pr-1.5 text-[#444] text-[10px]">…</span>}
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-0.5 w-64 bg-[#111] border border-[#2a2a2a] rounded-sm shadow-xl z-50 overflow-hidden">
                {searchResults.map((r) => (
                  <button key={r.yahooSymbol} onClick={() => selectResult(r)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-[#1a1a1a] text-[#aaa] transition-colors">
                    <div>
                      <span className="text-[11px] font-mono font-bold block">{r.symbol}</span>
                      <span className="text-[10px] text-[#555]">{r.name}</span>
                    </div>
                    <span className="text-[9px] font-mono text-[#444]">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live quote */}
          {last && (
            <div className="ml-2 flex items-center gap-2 font-mono">
              <span className="text-sm font-bold text-[#eee]">{last.close.toFixed(2)}</span>
              <span className={cn("text-xs flex items-center gap-0.5", chg >= 0 ? "text-green-400" : "text-red-400")}>
                {chg >= 0 ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
                {chg >= 0 ? "+" : ""}{chg.toFixed(2)} ({processed?.chgPct.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-[#555]">
                O:{last.open.toFixed(0)} H:{last.high.toFixed(0)} L:{last.low.toFixed(0)}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 font-mono text-[10px] text-[#555]">
            <span className={cn("px-1.5 py-0.5 border rounded-sm", isMarketOpen ? "border-emerald-800 text-emerald-400" : "border-[#2a2a2a] text-[#444]")}>
              {isMarketOpen ? "● LIVE" : "● CLOSED"}
            </span>
            <span>{lastUpdatedIST}</span>
            <span className="text-[#333]">↻{countdown}s</span>
            <button onClick={refresh} className="hover:text-primary transition-colors">
              <RefreshCw className="h-3 w-3" />
            </button>
            <button
              onClick={() => setShowMACD((v) => !v)}
              className={cn("px-1.5 py-0.5 border rounded-sm transition-colors",
                showMACD ? "border-primary/40 text-primary" : "border-[#2a2a2a] text-[#444] hover:border-[#444]"
              )}
            >
              MACD
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Chart area ──────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-[#1c1c1c]">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-[#555] font-mono text-sm">
              <Activity className="h-4 w-4 mr-2 animate-pulse" /> Loading 5M data…
            </div>
          ) : !processed ? (
            <div className="flex-1 flex items-center justify-center text-[#555] font-mono text-sm">
              No intraday data. Market may be closed.
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="shrink-0 flex items-center gap-4 px-3 py-1 border-b border-[#1a1a1a] text-[10px] font-mono">
                <span style={{ color: C.ema9 }}>── EMA 9</span>
                <span style={{ color: C.ema21 }}>── EMA 21</span>
                <span style={{ color: C.vwap }}>- - VWAP</span>
                <span className="text-[#555] ml-auto">{processed.n} candles · 5M · IST</span>
              </div>
              {/* Main chart */}
              <div ref={mainRef} className="flex-1 min-h-0" />
              {/* MACD */}
              {showMACD && (
                <div ref={macdRef} className="shrink-0 border-t border-[#1a1a1a]" style={{ height: 100 }} />
              )}
            </>
          )}
        </div>

        {/* ── Signal panel ─────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 overflow-y-auto bg-[#0a0a0a] flex flex-col">

          {/* Overall signal */}
          <div className="p-3 border-b border-[#1a1a1a]">
            <div className="text-[10px] font-mono text-[#555] mb-2">SCALP SIGNAL</div>
            {overall ? (
              <div className={cn("flex items-center gap-2 border rounded-sm px-3 py-2", overall.color)}>
                <overall.icon className="h-5 w-5" />
                <div>
                  <div className="text-lg font-bold font-mono">{overall.label}</div>
                  <div className="text-[10px] opacity-70">Score: {signal!.score > 0 ? "+" : ""}{signal!.score} / ±6</div>
                </div>
              </div>
            ) : (
              <div className="border border-[#2a2a2a] rounded-sm px-3 py-2 text-[#555] font-mono text-sm">
                No data
              </div>
            )}
          </div>

          {/* Indicator rows */}
          <div className="p-3 border-b border-[#1a1a1a]">
            <div className="text-[10px] font-mono text-[#555] mb-2">INDICATORS</div>
            <div className="space-y-1.5">
              {signal?.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-[#666] shrink-0">{row.label}</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono text-[#888] truncate">{row.value}</span>
                    <span className={cn(
                      "text-[9px] font-mono px-1 py-0.5 border rounded shrink-0",
                      row.bias === "BULLISH" ? "border-emerald-800 text-emerald-400" :
                      row.bias === "BEARISH" ? "border-red-900 text-red-400" :
                      "border-[#2a2a2a] text-[#555]"
                    )}>
                      {row.bias === "BULLISH" ? "▲" : row.bias === "BEARISH" ? "▼" : "–"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key levels */}
          {processed?.indicators && (
            <div className="p-3 border-b border-[#1a1a1a]">
              <div className="text-[10px] font-mono text-[#555] mb-2">KEY LEVELS</div>
              <div className="space-y-1">
                {[
                  { label: "ATR Stop",  value: processed.indicators.atr ? (processed.indicators.close - processed.indicators.atr).toFixed(1) : "–", sub: `ATR: ${processed.indicators.atr?.toFixed(1) ?? "–"}` },
                  { label: "BB Upper",  value: processed.indicators.bbUpper?.toFixed(1) ?? "–", sub: "resistance" },
                  { label: "BB Lower",  value: processed.indicators.bbLower?.toFixed(1) ?? "–", sub: "support"    },
                  { label: "VWAP",      value: processed.indicators.vwap?.toFixed(1)   ?? "–", sub: "intraday pivot" },
                  { label: "EMA 21",    value: processed.indicators.ema21?.toFixed(1)  ?? "–", sub: "dynamic S/R" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-baseline">
                    <div>
                      <span className="text-[10px] font-mono text-[#666]">{r.label}</span>
                      <span className="text-[9px] font-mono text-[#444] ml-1.5">{r.sub}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#aaa]">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options snapshot */}
          <div className="p-3 flex-1">
            <div className="text-[10px] font-mono text-[#555] mb-2">OPTIONS SNAPSHOT · {preset.optSymbol}</div>
            {optSnap ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-mono border border-[#1c1c1c] rounded-sm overflow-hidden">
                  <div className="bg-[#0d0d0d] p-1.5">
                    <div className="text-[9px] text-[#555]">PCR</div>
                    <div className={cn("font-bold", optSnap.pcr > 1.2 ? "text-emerald-400" : optSnap.pcr < 0.8 ? "text-red-400" : "text-yellow-400")}>{optSnap.pcr.toFixed(2)}</div>
                  </div>
                  <div className="bg-[#0d0d0d] p-1.5 border-x border-[#1c1c1c]">
                    <div className="text-[9px] text-[#555]">MAX PAIN</div>
                    <div className="font-bold text-[#aaa]">{optSnap.maxPainStrike.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="bg-[#0d0d0d] p-1.5">
                    <div className="text-[9px] text-[#555]">BIAS</div>
                    <div className={cn("font-bold", optSnap.pcr > 1 ? "text-emerald-400" : "text-red-400")}>
                      {optSnap.pcr > 1.2 ? "BULLISH" : optSnap.pcr < 0.8 ? "BEARISH" : "NEUTRAL"}
                    </div>
                  </div>
                </div>

                {/* Top OI strikes */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div>
                    <div className="text-[9px] text-emerald-600 mb-1">TOP CE STRIKES (OI)</div>
                    {optSnap.topCE.map((c) => (
                      <div key={c.strikePrice} className="flex justify-between text-[#666]">
                        <span>{c.strikePrice.toLocaleString("en-IN")}</span>
                        <span className="text-[#444]">{(c.openInterest / 1000).toFixed(0)}K</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[9px] text-red-700 mb-1">TOP PE STRIKES (OI)</div>
                    {optSnap.topPE.map((c) => (
                      <div key={c.strikePrice} className="flex justify-between text-[#666]">
                        <span>{c.strikePrice.toLocaleString("en-IN")}</span>
                        <span className="text-[#444]">{(c.openInterest / 1000).toFixed(0)}K</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CE vs PE OI bar */}
                <div>
                  <div className="flex justify-between text-[9px] font-mono text-[#555] mb-1">
                    <span>CE OI: {(optSnap.totalCE/1000).toFixed(0)}K</span>
                    <span>PE OI: {(optSnap.totalPE/1000).toFixed(0)}K</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-[#1c1c1c] flex">
                    <div className="bg-emerald-600/60" style={{ width: `${(optSnap.totalCE / (optSnap.totalCE + optSnap.totalPE)) * 100}%` }} />
                    <div className="bg-red-700/60 flex-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-[#555]">Loading options data…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
