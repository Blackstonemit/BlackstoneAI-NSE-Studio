import { useState, useMemo } from "react";
import { useGetMarketHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Info, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from "recharts";
import { loadSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// ── Black-Scholes implementation ──────────────────────────────────────────────

function erf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function ncdf(x: number) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }

function bs(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return type === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return type === "CE"
    ? S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2)
    : K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1);
}

function bsDelta(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  return type === "CE" ? ncdf(d1) : ncdf(d1) - 1;
}

function bsTheta(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const pdf1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  const term1 = -(S * sigma * pdf1) / (2 * Math.sqrt(T));
  const term2 = type === "CE"
    ? -r * K * Math.exp(-r * T) * ncdf(d2)
    : r * K * Math.exp(-r * T) * ncdf(-d2);
  return (term1 + term2) / 365;
}

// ── Strategy types ────────────────────────────────────────────────────────────

type Leg = { strike: number; type: "CE" | "PE"; direction: 1 | -1 };
type Strategy = { name: string; legs: (strikes: number[]) => Leg[] };

const STRATEGIES: Record<string, Strategy> = {
  longCall:   { name: "Long Call",         legs: ([k]) => [{ strike: k, type: "CE", direction: 1 }] },
  shortCall:  { name: "Short Call",        legs: ([k]) => [{ strike: k, type: "CE", direction: -1 }] },
  longPut:    { name: "Long Put",          legs: ([k]) => [{ strike: k, type: "PE", direction: 1 }] },
  shortPut:   { name: "Short Put",         legs: ([k]) => [{ strike: k, type: "PE", direction: -1 }] },
  bullCallSpread: {
    name: "Bull Call Spread",
    legs: ([k1, k2]) => [{ strike: k1, type: "CE", direction: 1 }, { strike: k2, type: "CE", direction: -1 }],
  },
  bearPutSpread: {
    name: "Bear Put Spread",
    legs: ([k1, k2]) => [{ strike: k2, type: "PE", direction: 1 }, { strike: k1, type: "PE", direction: -1 }],
  },
};

function isSingleLeg(key: string) { return ["longCall", "shortCall", "longPut", "shortPut"].includes(key); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toFixed(2); }
function fmtPnl(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(0)}`; }
function dateToStr(d: Date) { return d.toISOString().slice(0, 10); }

export default function BacktestPage() {
  const settings = loadSettings();

  const [symbol, setSymbol] = useState(settings.defaultSymbol);
  const [stratKey, setStratKey] = useState("longCall");
  const [strike1, setStrike1] = useState("");
  const [strike2, setStrike2] = useState("");
  const [entryDate, setEntryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return dateToStr(d);
  });
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d);
  });
  const [iv, setIv] = useState(String(settings.defaultIV));
  const [lots, setLots] = useState("1");
  const [runKey, setRunKey] = useState(0);

  const enabled = runKey > 0;
  const periodDays = Math.ceil((new Date(expiryDate).getTime() - new Date(entryDate).getTime()) / 86400000) + 5;
  const period = periodDays <= 7 ? "5d" : periodDays <= 30 ? "1mo" : periodDays <= 90 ? "3mo" : periodDays <= 180 ? "6mo" : "1y";

  const yahooSymbol = symbol === "NIFTY" ? "NIFTY" : symbol === "BANKNIFTY" ? "BANKNIFTY" : symbol;

  const { data: history, isLoading, isError } = useGetMarketHistory(
    { symbol: yahooSymbol, period, interval: "1d" },
    { query: { enabled, staleTime: 60000 } }
  );

  const results = useMemo(() => {
    if (!history || !enabled) return null;

    const k1 = parseFloat(strike1);
    const k2 = parseFloat(strike2);
    if (!k1 || isNaN(k1)) return null;
    if (!isSingleLeg(stratKey) && (!k2 || isNaN(k2))) return null;

    const strat = STRATEGIES[stratKey];
    const strikes = isSingleLeg(stratKey) ? [k1] : [k1, k2];
    const legs = strat.legs(strikes);

    const sigma = parseFloat(iv) / 100;
    const r = settings.riskFreeRate / 100;
    const lotSize = settings.lotSize;
    const numLots = parseInt(lots) || 1;
    const multiplier = lotSize * numLots;

    const expiry = new Date(expiryDate);
    const entry = new Date(entryDate);

    const candles = history.candles.filter((c) => {
      const d = new Date(c.timestamp);
      return d >= entry && d <= expiry;
    });

    if (candles.length === 0) return null;

    const entryCandle = candles[0];
    const entrySpot = entryCandle.close;
    const entryT = (expiry.getTime() - new Date(entryCandle.timestamp).getTime()) / (365 * 86400000);

    const entryPremium = legs.reduce(
      (sum, leg) => sum + leg.direction * bs(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );

    const entryDelta = legs.reduce(
      (sum, leg) => sum + leg.direction * bsDelta(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );
    const entryTheta = legs.reduce(
      (sum, leg) => sum + leg.direction * bsTheta(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );

    const chartData = candles.map((c) => {
      const spot = c.close;
      const T = Math.max(0, (expiry.getTime() - new Date(c.timestamp).getTime()) / (365 * 86400000));
      const currentVal = legs.reduce(
        (sum, leg) => sum + leg.direction * bs(spot, leg.strike, T, r, sigma, leg.type),
        0
      );
      const pnl = (currentVal - entryPremium) * multiplier;
      return {
        date: new Date(c.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        pnl: Math.round(pnl),
        spot: Math.round(spot),
        optionValue: Math.round(currentVal * 100) / 100,
      };
    });

    const pnls = chartData.map((d) => d.pnl);
    const maxPnl = Math.max(...pnls);
    const minPnl = Math.min(...pnls);
    const finalPnl = pnls[pnls.length - 1] ?? 0;

    const breakeven = legs.length === 1
      ? legs[0].type === "CE"
        ? legs[0].strike + entryPremium * legs[0].direction
        : legs[0].strike - entryPremium * legs[0].direction
      : null;

    return { chartData, maxPnl, minPnl, finalPnl, entryPremium, entryDelta, entryTheta, entrySpot, breakeven, legs, multiplier };
  }, [history, enabled, strike1, strike2, stratKey, iv, lots, entryDate, expiryDate, settings]);

  const needsStrike2 = !isSingleLeg(stratKey);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS BACKTEST</h1>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground border border-muted rounded-sm px-2 py-1">
          <BarChart3 className="h-3 w-3 text-primary" />
          BLACK-SCHOLES ENGINE
        </div>
      </div>

      {/* Config Card */}
      <Card className="rounded-sm border-muted bg-card">
        <CardHeader className="p-4 border-b border-muted">
          <CardTitle className="text-sm font-mono">STRATEGY CONFIGURATION</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">SYMBOL</label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="font-mono uppercase bg-background border-muted" placeholder="NIFTY" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">STRATEGY</label>
              <Select value={stratKey} onValueChange={setStratKey}>
                <SelectTrigger className="font-mono border-muted bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STRATEGIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">{needsStrike2 ? "STRIKE 1 (BUY)" : "STRIKE"}</label>
              <Input value={strike1} onChange={(e) => setStrike1(e.target.value)}
                type="number" className="font-mono bg-background border-muted" placeholder="e.g. 23000" />
            </div>
            {needsStrike2 && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">STRIKE 2 (SELL)</label>
                <Input value={strike2} onChange={(e) => setStrike2(e.target.value)}
                  type="number" className="font-mono bg-background border-muted" placeholder="e.g. 23200" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">ENTRY DATE</label>
              <Input value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                type="date" className="font-mono bg-background border-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">EXPIRY DATE</label>
              <Input value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                type="date" className="font-mono bg-background border-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">IMPLIED VOL (%)</label>
              <Input value={iv} onChange={(e) => setIv(e.target.value)}
                type="number" step="0.5" className="font-mono bg-background border-muted" placeholder="15" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">LOTS</label>
              <Input value={lots} onChange={(e) => setLots(e.target.value)}
                type="number" min="1" className="font-mono bg-background border-muted" placeholder="1" />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => setRunKey((k) => k + 1)} disabled={isLoading}
              className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
              <Play className="h-4 w-4 mr-2" />
              RUN BACKTEST
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Info className="h-3 w-3" />
              Uses historical spot prices + Black-Scholes option pricing
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          <Skeleton className="h-80 w-full md:col-span-4" />
        </div>
      )}

      {isError && (
        <div className="py-20 text-center border border-red-500/30 border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-red-400">FAILED TO FETCH HISTORICAL DATA</h3>
          <p className="text-sm text-muted-foreground mt-2">Check the symbol and date range.</p>
        </div>
      )}

      {enabled && !isLoading && !isError && !results && (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOR GIVEN PARAMETERS</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Adjust the date range or symbol. Ensure Strike is a valid number.
          </p>
        </div>
      )}

      {results && !isLoading && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "ENTRY PREMIUM", value: `₹${fmt(results.entryPremium)}`, sub: `${results.multiplier} units`, color: "text-foreground" },
              {
                label: "FINAL P&L",
                value: `₹${fmtPnl(results.finalPnl)}`,
                sub: results.finalPnl >= 0 ? "PROFIT" : "LOSS",
                color: results.finalPnl >= 0 ? "text-success" : "text-destructive",
              },
              {
                label: "MAX PROFIT",
                value: `₹${fmtPnl(results.maxPnl)}`,
                sub: "Peak gain",
                color: "text-success",
              },
              {
                label: "MAX LOSS",
                value: `₹${fmtPnl(results.minPnl)}`,
                sub: "Worst drawdown",
                color: "text-destructive",
              },
            ].map((s) => (
              <Card key={s.label} className="rounded-sm border-muted bg-card">
                <CardContent className="p-4">
                  <div className="text-xs font-mono text-muted-foreground mb-1">{s.label}</div>
                  <div className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</div>
                  <div className="text-xs font-mono text-muted-foreground mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Entry Greeks + Legs */}
          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
                <div><div className="text-muted-foreground mb-1">ENTRY SPOT</div><div className="font-bold text-lg">₹{fmt(results.entrySpot)}</div></div>
                <div><div className="text-muted-foreground mb-1">DELTA</div><div className="font-bold text-lg">{fmt(results.entryDelta)}</div></div>
                <div><div className="text-muted-foreground mb-1">THETA / DAY</div><div className="font-bold text-lg text-destructive">{fmt(results.entryTheta)}</div></div>
                <div><div className="text-muted-foreground mb-1">BREAKEVEN</div><div className="font-bold text-lg">{results.breakeven ? `₹${fmt(results.breakeven)}` : "—"}</div></div>
                <div>
                  <div className="text-muted-foreground mb-1">LEGS</div>
                  <div className="flex flex-wrap gap-1">
                    {results.legs.map((leg, i) => (
                      <Badge key={i} variant="outline" className={cn(
                        "text-[10px] font-mono border-0",
                        leg.direction === 1 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      )}>
                        {leg.direction === 1 ? "BUY" : "SELL"} {leg.strike} {leg.type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* P&L Chart */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono">P&L OVER TIME (₹)</CardTitle>
              <div className="flex items-center gap-3 text-xs font-mono">
                {results.finalPnl >= 0
                  ? <span className="flex items-center gap-1 text-success"><TrendingUp className="h-3 w-3" /> PROFITABLE</span>
                  : <span className="flex items-center gap-1 text-destructive"><TrendingDown className="h-3 w-3" /> LOSS</span>}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={results.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#888" }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#888" }}
                    tickFormatter={(v) => v >= 0 ? `+${(v / 1000).toFixed(1)}K` : `${(v / 1000).toFixed(1)}K`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 11 }}
                    formatter={(val: number) => [`₹${fmtPnl(val)}`, "P&L"]}
                  />
                  <ReferenceLine y={0} stroke="#555" strokeDasharray="4 4" />
                  {results.maxPnl > 0 && (
                    <ReferenceLine y={results.maxPnl} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Max", fill: "#22c55e", fontSize: 9, fontFamily: "monospace" }} />
                  )}
                  {results.minPnl < 0 && (
                    <ReferenceLine y={results.minPnl} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Min", fill: "#ef4444", fontSize: 9, fontFamily: "monospace" }} />
                  )}
                  <Area type="monotone" dataKey="pnl" stroke={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"}
                    strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily table */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono">DAILY P&L BREAKDOWN</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-muted bg-muted/20">
                      <th className="py-2 px-4 text-left text-muted-foreground font-normal">DATE</th>
                      <th className="py-2 px-4 text-right text-muted-foreground font-normal">SPOT</th>
                      <th className="py-2 px-4 text-right text-muted-foreground font-normal">OPTION VALUE</th>
                      <th className="py-2 px-4 text-right text-muted-foreground font-normal">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.chartData.map((row, i) => (
                      <tr key={i} className="border-b border-muted/30 hover:bg-muted/10">
                        <td className="py-1.5 px-4">{row.date}</td>
                        <td className="py-1.5 px-4 text-right">₹{row.spot.toLocaleString("en-IN")}</td>
                        <td className="py-1.5 px-4 text-right">₹{fmt(row.optionValue)}</td>
                        <td className={cn("py-1.5 px-4 text-right font-bold", row.pnl >= 0 ? "text-success" : "text-destructive")}>
                          {fmtPnl(row.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
