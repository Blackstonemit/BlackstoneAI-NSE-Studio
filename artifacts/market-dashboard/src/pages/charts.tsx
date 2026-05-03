import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useGetMarketHistory,
  GetMarketHistoryInterval,
  GetMarketHistoryPeriod,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { loadSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import {
  CandlestickChart,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

// ── Symbol presets ────────────────────────────────────────────────────────────

type Preset = { label: string; apiSymbol: string; tag: string };

const PRESETS: Preset[] = [
  { label: "NIFTY 50",   apiSymbol: "NIFTY",     tag: "IDX" },
  { label: "BANKNIFTY",  apiSymbol: "BANKNIFTY",  tag: "IDX" },
  { label: "FINNIFTY",   apiSymbol: "FINNIFTY",   tag: "IDX" },
  { label: "SENSEX",     apiSymbol: "SENSEX",     tag: "IDX" },
  { label: "RELIANCE",   apiSymbol: "RELIANCE",   tag: "STK" },
  { label: "TCS",        apiSymbol: "TCS",        tag: "STK" },
  { label: "HDFCBANK",   apiSymbol: "HDFCBANK",   tag: "STK" },
  { label: "INFY",       apiSymbol: "INFY",       tag: "STK" },
  { label: "ICICIBANK",  apiSymbol: "ICICIBANK",  tag: "STK" },
  { label: "SBIN",       apiSymbol: "SBIN",       tag: "STK" },
];

// ── Interval config ───────────────────────────────────────────────────────────

type IntervalCfg = {
  label: string;
  apiInterval: GetMarketHistoryInterval;
  apiPeriod: GetMarketHistoryPeriod;
};

const INTERVALS: IntervalCfg[] = [
  { label: "1m",  apiInterval: "1m",  apiPeriod: "1d"  },
  { label: "5m",  apiInterval: "5m",  apiPeriod: "5d"  },
  { label: "15m", apiInterval: "15m", apiPeriod: "5d"  },
  { label: "1H",  apiInterval: "1h",  apiPeriod: "1mo" },
  { label: "1D",  apiInterval: "1d",  apiPeriod: "1y"  },
];

// ── Chart styles ──────────────────────────────────────────────────────────────

type ChartStyle = "candles" | "line" | "area";

// ── Technical indicator helpers ───────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (ema === null) {
      const slice = closes.slice(0, period);
      ema = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result[i] = ema;
  }
  return result;
}

function calcBB(closes: number[], period = 20, mult = 2) {
  const sma = calcSMA(closes, period);
  return closes.map((_, i) => {
    if (sma[i] === null) return { upper: null, mid: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    return { upper: mean + mult * sd, mid: mean, lower: mean - mult * sd };
  });
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  bg:           "#0a0a0a",
  grid:         "#1c1c1c",
  border:       "#2a2a2a",
  text:         "#888",
  up:           "#22c55e",
  down:         "#ef4444",
  upBg:         "rgba(34,197,94,0.10)",
  downBg:       "rgba(239,68,68,0.10)",
  sma20:        "#f59e0b",
  ema9:         "#818cf8",
  bbUpper:      "rgba(99,102,241,0.5)",
  bbMid:        "rgba(99,102,241,0.3)",
  bbLower:      "rgba(99,102,241,0.5)",
  vol:          "rgba(100,116,139,0.5)",
  rsi:          "#22d3ee",
  rsiOB:        "rgba(239,68,68,0.15)",
  rsiOS:        "rgba(34,197,94,0.15)",
};

const CHART_OPTS = {
  layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
};

// ── Overlay toggles ───────────────────────────────────────────────────────────

type OverlayKey = "sma20" | "ema9" | "bb" | "vol" | "rsi";

const OVERLAY_LABELS: Record<OverlayKey, string> = {
  sma20: "SMA 20",
  ema9:  "EMA 9",
  bb:    "Bollinger",
  vol:   "Volume",
  rsi:   "RSI 14",
};

// ── Search result type ────────────────────────────────────────────────────────
type SearchResult = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  type: string;
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ChartsPage() {
  const settings = loadSettings();

  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [intervalCfg, setIntervalCfg] = useState<IntervalCfg>(INTERVALS[1]); // 5m
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candles");
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    sma20: true, ema9: true, bb: false, vol: true, rsi: true,
  });
  const [fullscreen, setFullscreen] = useState(false);

  // ── Symbol search state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIdx, setSelectedIdx]   = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiSymbol = preset.apiSymbol;

  const { data: history, isLoading, isError, refetch } = useGetMarketHistory(
    { symbol: apiSymbol, interval: intervalCfg.apiInterval, period: intervalCfg.apiPeriod },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { staleTime: 60_000 } as any }
  );

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => { refetch(); },
  });

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const mainRef   = useRef<HTMLDivElement>(null);
  const rsiRef    = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const rsiChart  = useRef<IChartApi | null>(null);

  // ── Computed candle / overlay data ────────────────────────────────────────
  const processed = useMemo(() => {
    if (!history?.candles.length) return null;
    // Filter out zero/null price candles (market closed / bad ticks)
    const candles = history.candles.filter(
      (c) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
    );
    if (!candles.length) return null;
    const times = candles.map((c) => Math.floor(new Date(c.timestamp).getTime() / 1000) as UTCTimestamp);
    const closes = candles.map((c) => c.close);

    const ohlc: CandlestickData[] = candles.map((c, i) => ({
      time: times[i],
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    const volume: HistogramData[] = candles.map((c, i) => ({
      time: times[i],
      value: c.volume,
      color: c.close >= c.open ? C.upBg : C.downBg,
    }));
    const sma20Data: LineData[] = calcSMA(closes, 20).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];
    const ema9Data: LineData[] = calcEMA(closes, 9).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];
    const bbData = calcBB(closes);
    const bbUpper: LineData[] = bbData.map((b, i) =>
      b.upper !== null ? { time: times[i], value: b.upper } : null
    ).filter(Boolean) as LineData[];
    const bbMid: LineData[] = bbData.map((b, i) =>
      b.mid !== null ? { time: times[i], value: b.mid } : null
    ).filter(Boolean) as LineData[];
    const bbLower: LineData[] = bbData.map((b, i) =>
      b.lower !== null ? { time: times[i], value: b.lower } : null
    ).filter(Boolean) as LineData[];
    const rsiData: LineData[] = calcRSI(closes).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const chg = last && prev ? last.close - prev.close : 0;
    const chgPct = prev ? (chg / prev.close) * 100 : 0;

    return { ohlc, volume, sma20Data, ema9Data, bbUpper, bbMid, bbLower, rsiData, last, chg, chgPct };
  }, [history]);

  // ── Build charts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !processed) return;

    // Destroy previous
    mainChart.current?.remove();
    rsiChart.current?.remove();
    mainChart.current = null;
    rsiChart.current = null;

    // Main chart
    const mc = createChart(mainRef.current, {
      ...CHART_OPTS,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });
    mainChart.current = mc;

    // Price series
    if (chartStyle === "candles") {
      const cs = mc.addSeries(CandlestickSeries, {
        upColor: C.up, downColor: C.down,
        borderUpColor: C.up, borderDownColor: C.down,
        wickUpColor: C.up, wickDownColor: C.down,
      });
      cs.setData(processed.ohlc);
    } else if (chartStyle === "line") {
      const ls = mc.addSeries(LineSeries, { color: C.up, lineWidth: 2 });
      ls.setData(processed.ohlc.map((d) => ({ time: d.time, value: d.close })));
    } else {
      const as = mc.addSeries(AreaSeries, {
        lineColor: C.up, topColor: "rgba(34,197,94,0.25)",
        bottomColor: "rgba(34,197,94,0.02)", lineWidth: 2,
      });
      as.setData(processed.ohlc.map((d) => ({ time: d.time, value: d.close })));
    }

    // Overlays on main chart
    if (overlays.sma20) {
      const s = mc.addSeries(LineSeries, { color: C.sma20, lineWidth: 1, title: "SMA 20" });
      s.setData(processed.sma20Data);
    }
    if (overlays.ema9) {
      const s = mc.addSeries(LineSeries, { color: C.ema9, lineWidth: 1, title: "EMA 9" });
      s.setData(processed.ema9Data);
    }
    if (overlays.bb) {
      const u = mc.addSeries(LineSeries, { color: C.bbUpper, lineWidth: 1, lineStyle: 2, title: "BB Upper" });
      const m = mc.addSeries(LineSeries, { color: C.bbMid,   lineWidth: 1, lineStyle: 3, title: "BB Mid"   });
      const l = mc.addSeries(LineSeries, { color: C.bbLower, lineWidth: 1, lineStyle: 2, title: "BB Lower" });
      u.setData(processed.bbUpper);
      m.setData(processed.bbMid);
      l.setData(processed.bbLower);
    }

    // Volume as histogram pane (separate pane in main chart)
    if (overlays.vol) {
      const vs = mc.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      mc.priceScale("vol").applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });
      vs.setData(processed.volume);
    }

    mc.timeScale().fitContent();

    // RSI pane (separate chart below)
    if (overlays.rsi && rsiRef.current) {
      const rc = createChart(rsiRef.current, {
        ...CHART_OPTS,
        width: rsiRef.current.clientWidth,
        height: rsiRef.current.clientHeight,
        rightPriceScale: { ...CHART_OPTS.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { ...CHART_OPTS.timeScale, visible: false },
      });
      rsiChart.current = rc;

      const rs = rc.addSeries(LineSeries, { color: C.rsi, lineWidth: 2, title: "RSI 14" });
      rs.setData(processed.rsiData);

      // OB/OS bands
      const ob70 = rc.addSeries(LineSeries, { color: "rgba(239,68,68,0.5)", lineWidth: 1, lineStyle: 2 });
      ob70.setData(processed.rsiData.map((d) => ({ time: d.time, value: 70 })));
      const os30 = rc.addSeries(LineSeries, { color: "rgba(34,197,94,0.5)", lineWidth: 1, lineStyle: 2 });
      os30.setData(processed.rsiData.map((d) => ({ time: d.time, value: 30 })));

      rc.timeScale().fitContent();

      // Sync crosshairs
      mc.subscribeCrosshairMove((p) => {
        if (!p.time) return;
        rc.setCrosshairPosition(0, p.time as UTCTimestamp, rs);
      });
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current) mc.applyOptions({ width: mainRef.current.clientWidth, height: mainRef.current.clientHeight });
      if (rsiRef.current && rsiChart.current) rsiChart.current.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight });
    });
    if (mainRef.current) ro.observe(mainRef.current);
    if (rsiRef.current) ro.observe(rsiRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove();
      rsiChart.current?.remove();
      mainChart.current = null;
      rsiChart.current = null;
    };
  }, [processed, chartStyle, overlays]);

  const toggleOverlay = (k: OverlayKey) =>
    setOverlays((prev) => ({ ...prev, [k]: !prev[k] }));

  // ── Search logic ────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setSelectedIdx(-1);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchOpen(true);
    setSelectedIdx(-1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(val), 280);
  };

  const selectResult = (r: SearchResult) => {
    setPreset({ label: r.symbol, apiSymbol: r.symbol, tag: r.type === "Index" ? "IDX" : "STK" });
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults([]);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchOpen(false); return; }
    if (e.key === "ArrowDown") { setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1)); return; }
    if (e.key === "ArrowUp")   { setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      if (selectedIdx >= 0 && searchResults[selectedIdx]) {
        selectResult(searchResults[selectedIdx]);
      } else {
        const sym = searchQuery.trim().toUpperCase();
        if (sym) { setPreset({ label: sym, apiSymbol: sym, tag: "STK" }); setSearchQuery(""); setSearchOpen(false); }
      }
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const last = processed?.last;
  const chg  = processed?.chg ?? 0;

  return (
    <div className={cn(
      "flex flex-col bg-[#0a0a0a]",
      fullscreen ? "fixed inset-0 z-50" : "-m-6 h-[calc(100vh-0px)]"
    )} style={{ height: fullscreen ? "100vh" : "calc(100vh - 0px)" }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[#1c1c1c] bg-[#0d0d0d]">
        {/* Row 1: symbol presets + quote */}
        <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1 font-mono text-xs font-bold text-primary">
            <CandlestickChart className="h-3.5 w-3.5" />
            CHARTS
          </div>

          <div className="flex flex-wrap items-center gap-1">
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
                <span className="text-[8px] text-[#555]">{p.tag}</span>
              </button>
            ))}
          </div>

          {/* Live symbol search */}
          <div ref={searchRef} className="relative ml-1">
            <div className="flex items-center gap-0 border border-[#2a2a2a] rounded-sm overflow-visible bg-[#111] focus-within:border-primary transition-colors">
              <span className="pl-1.5 text-[#444]">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                value={searchQuery}
                onChange={onSearchChange}
                onKeyDown={onSearchKeyDown}
                onFocus={() => { if (searchQuery) setSearchOpen(true); }}
                placeholder="Search symbol…"
                className="w-32 h-6 px-1.5 text-[11px] font-mono bg-transparent text-[#aaa] placeholder:text-[#444] focus:outline-none"
              />
              {searchLoading && (
                <span className="pr-1.5 text-[#444] animate-spin">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                </span>
              )}
            </div>
            {/* Dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-0.5 w-72 bg-[#111] border border-[#2a2a2a] rounded-sm shadow-xl z-50 overflow-hidden">
                {searchResults.map((r, i) => (
                  <button
                    key={r.yahooSymbol}
                    onClick={() => selectResult(r)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors",
                      i === selectedIdx ? "bg-primary/20 text-primary" : "hover:bg-[#1a1a1a] text-[#aaa]"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] font-mono font-bold leading-none">{r.symbol}</span>
                      <span className="text-[10px] text-[#555] truncate max-w-[180px]">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] font-mono text-[#444]">{r.exchange}</span>
                      <span className="text-[9px] font-mono px-1 py-0.5 border border-[#2a2a2a] rounded text-[#555]">{r.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchOpen && !searchLoading && searchQuery.length > 0 && searchResults.length === 0 && (
              <div className="absolute top-full left-0 mt-0.5 w-56 bg-[#111] border border-[#2a2a2a] rounded-sm shadow-xl z-50 px-3 py-2 text-[11px] font-mono text-[#555]">
                No NSE/BSE results
              </div>
            )}
          </div>

          {/* Live quote */}
          {last && (
            <div className="ml-auto flex items-center gap-3 font-mono">
              <span className="text-sm font-bold text-[#eee]">
                {last.close.toFixed(2)}
              </span>
              <span className={cn("flex items-center gap-1 text-xs",
                chg >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {chg >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {chg >= 0 ? "+" : ""}{chg.toFixed(2)} ({processed?.chgPct.toFixed(2)}%)
              </span>
              <span className="text-[10px] text-[#555]">O:{last.open.toFixed(0)} H:{last.high.toFixed(0)} L:{last.low.toFixed(0)}</span>
            </div>
          )}

          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={refresh}
            isRefreshing={isLoading}
            className="text-[#666]"
          />
          <button onClick={() => setFullscreen((f) => !f)} className="h-6 px-1.5 text-[10px] font-mono border border-[#2a2a2a] rounded-sm text-[#555] hover:text-primary hover:border-primary transition-colors">
            {fullscreen ? "EXIT FS" : "⛶ FS"}
          </button>
        </div>

        {/* Row 2: interval + style + overlays */}
        <div className="flex items-center gap-3 px-3 py-1 border-t border-[#151515] flex-wrap">
          {/* Intervals */}
          <div className="flex items-center border border-[#2a2a2a] rounded-sm overflow-hidden">
            {INTERVALS.map((iv) => (
              <button
                key={iv.label}
                onClick={() => setIntervalCfg(iv)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-mono transition-colors",
                  intervalCfg.label === iv.label
                    ? "bg-primary text-black font-bold"
                    : "text-[#666] hover:bg-[#1c1c1c] hover:text-[#aaa]"
                )}
              >
                {iv.label}
              </button>
            ))}
          </div>

          <div className="h-3 w-px bg-[#2a2a2a]" />

          {/* Chart style */}
          <div className="flex items-center border border-[#2a2a2a] rounded-sm overflow-hidden">
            {(["candles", "line", "area"] as ChartStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setChartStyle(s)}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-mono capitalize transition-colors",
                  chartStyle === s ? "bg-[#2a2a2a] text-[#eee]" : "text-[#666] hover:bg-[#1a1a1a] hover:text-[#aaa]"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-3 w-px bg-[#2a2a2a]" />

          {/* Overlay toggles */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-mono text-[#444] mr-0.5">OVERLAY:</span>
            {(Object.keys(OVERLAY_LABELS) as OverlayKey[]).map((k) => {
              const colorMap: Record<OverlayKey, string> = {
                sma20: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10",
                ema9:  "text-indigo-400 border-indigo-500/50 bg-indigo-500/10",
                bb:    "text-indigo-300 border-indigo-400/50 bg-indigo-400/10",
                vol:   "text-slate-400 border-slate-500/50 bg-slate-500/10",
                rsi:   "text-cyan-400 border-cyan-500/50 bg-cyan-500/10",
              };
              return (
                <button
                  key={k}
                  onClick={() => toggleOverlay(k)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-mono border rounded-full transition-colors",
                    overlays[k] ? colorMap[k] : "border-[#2a2a2a] text-[#444] hover:border-[#444]"
                  )}
                >
                  {OVERLAY_LABELS[k]}
                </button>
              );
            })}
          </div>

          {/* Symbol + interval label */}
          <div className="ml-auto text-[11px] font-mono text-[#555]">
            <span className="text-[#aaa] font-bold">{preset.label}</span>
            <Minus className="inline h-3 w-3 mx-1 opacity-40" />
            <span>{intervalCfg.label}</span>
            <Minus className="inline h-3 w-3 mx-1 opacity-40" />
            <span>IST</span>
          </div>
        </div>
      </div>

      {/* ── Loading / error states ───────────────────────────────────────── */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 font-mono text-[#444]">
            <div className="flex gap-1.5 items-end h-8">
              {[0.4, 0.7, 1, 0.6, 0.85].map((h, i) => (
                <div key={i} className="w-3 rounded-sm animate-pulse"
                  style={{ height: `${h * 32}px`, background: i % 2 === 0 ? "#ef4444" : "#22c55e", animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <span className="text-xs tracking-widest">LOADING CHART DATA…</span>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center font-mono text-center">
          <div>
            <div className="text-red-400 font-bold mb-2">FAILED TO LOAD DATA</div>
            <div className="text-[#555] text-sm">Symbol not found or markets closed</div>
            <button onClick={() => refetch()} className="mt-4 px-4 py-1.5 text-xs border border-[#333] rounded-sm text-[#888] hover:border-primary hover:text-primary transition-colors">
              RETRY
            </button>
          </div>
        </div>
      )}

      {/* ── Main chart pane ──────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={mainRef} className={cn("w-full", overlays.rsi ? "h-[70%]" : "h-full")} />
          {overlays.rsi && (
            <>
              <div className="border-t border-[#1c1c1c] px-3 py-0.5 shrink-0">
                <span className="text-[10px] font-mono text-cyan-500/70 tracking-wider">RSI (14)</span>
              </div>
              <div ref={rsiRef} className="w-full h-[28%]" />
            </>
          )}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#151515] px-3 py-0.5 flex items-center justify-between text-[9px] font-mono text-[#333]">
        <span>lightweight-charts · Data: Yahoo Finance / NSE</span>
        <span>All times IST (UTC+5:30)</span>
      </div>
    </div>
  );
}
