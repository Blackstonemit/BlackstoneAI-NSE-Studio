import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTechnicalAnalysis, 
  getGetTechnicalAnalysisQueryKey,
  useRunAgentAnalysis,
  GetTechnicalAnalysisInterval
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2, BrainCircuit, Cpu, TrendingUp, TrendingDown, ShieldAlert, X, Sliders, Activity, BarChart3, Zap, Waves } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type AgentResult = {
  symbol: string;
  summary: string;
  keyLevels: { support: number[]; resistance: number[] };
  signals: Array<{
    action: string;
    displayText: string;
    entryPrice: number | null;
    targetPrice: number | null;
    stopLoss: number | null;
    confidence: number;
    rationale: string;
    instrumentType: string;
  }>;
  riskAssessment: string;
  generatedAt: string;
};

function fmt(v: number | null | undefined, dec = 2) {
  return v != null ? v.toFixed(dec) : "N/A";
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center border-b border-muted pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-bold", color)}>{value}</span>
    </div>
  );
}

export default function AnalysisBoard() {
  const agentSettings = loadSettings();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState(agentSettings.defaultSymbol);
  const [searchInput, setSearchInput] = useState(agentSettings.defaultSymbol);
  const [interval, setAnalysisInterval] = useState<GetTechnicalAnalysisInterval>("1d");
  const [instrumentType, setInstrumentType] = useState<string>(agentSettings.agentInstrumentType);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [autoRanOnce, setAutoRanOnce] = useState(false);

  const { toast } = useToast();

  const { data: analysis, isLoading: loadingAnalysis, isError: analysisError } = useGetTechnicalAnalysis(
    { symbol, interval },
    { query: { queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }), retry: 1 } }
  );

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }) });
    },
  });

  const runAgent = useRunAgentAnalysis();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setAgentResult(null);
    }
  };

  const handleAnalyze = (overrideSymbol?: string) => {
    const targetSymbol = overrideSymbol ?? (searchInput.trim().toUpperCase() || symbol);
    if (targetSymbol !== symbol && !overrideSymbol) {
      setSymbol(targetSymbol);
      setAgentResult(null);
    }
    const settings = loadSettings();
    runAgent.mutate({
      data: {
        symbol: targetSymbol,
        timeframe: settings.agentTimeframe,
        instrumentType,
        numSignals: settings.agentNumSignals,
        maxTokens: settings.agentMaxTokens,
        style: settings.agentStyle,
        customContext: settings.agentCustomContext,
        confidenceThreshold: settings.agentConfidenceThreshold,
        saveSignals: settings.agentSaveSignals,
      } as Parameters<typeof runAgent.mutate>[0]["data"]
    }, {
      onSuccess: (result) => {
        setAgentResult(result as unknown as AgentResult);
        toast({ title: "AI Analysis Complete", description: `Analysis ready for ${targetSymbol}` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to run agent analysis.", variant: "destructive" });
      },
    });
  };

  useEffect(() => {
    if (agentSettings.agentAutoRun && !autoRanOnce) {
      setAutoRanOnce(true);
      handleAnalyze(symbol);
    }
  }, []);

  const confidenceThreshold = agentSettings.agentConfidenceThreshold;
  const filteredSignals = agentResult?.signals.filter((s) => s.confidence >= confidenceThreshold) ?? [];

  const styleColors: Record<string, string> = {
    conservative: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    moderate: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    aggressive: "text-red-400 border-red-500/30 bg-red-500/10",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight font-mono">TECHNICAL ANALYSIS</h1>
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={refresh}
          />
          {analysis?.indiaVix != null && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-mono border rounded-sm px-2 py-1",
              analysis.indiaVix > 20 ? "border-destructive/40 text-destructive bg-destructive/5" :
              analysis.indiaVix > 15 ? "border-warning/40 text-warning bg-warning/5" :
              "border-success/40 text-success bg-success/5"
            )}>
              <Waves className="h-3 w-3" />
              VIX {analysis.indiaVix.toFixed(2)}
            </div>
          )}
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[180px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>

          <Select value={interval} onValueChange={(v: GetTechnicalAnalysisInterval) => setAnalysisInterval(v)}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue placeholder="INTERVAL" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 MIN</SelectItem>
              <SelectItem value="15m">15 MIN</SelectItem>
              <SelectItem value="1h">1 HOUR</SelectItem>
              <SelectItem value="1d">1 DAY</SelectItem>
            </SelectContent>
          </Select>

          <Select value={instrumentType} onValueChange={setInstrumentType}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STOCK">STOCK</SelectItem>
              <SelectItem value="INDEX">INDEX</SelectItem>
              <SelectItem value="OPTIONS">OPTIONS</SelectItem>
              <SelectItem value="FUTURES">FUTURES</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 text-xs font-mono border border-muted rounded-sm px-2 py-1">
            <Cpu className="h-3 w-3 text-success" />
            <span className="text-muted-foreground">OPENAI GPT-5.4</span>
          </div>

          <div className={cn(
            "hidden sm:flex items-center gap-1 text-[10px] font-mono border rounded-sm px-2 py-1",
            styleColors[agentSettings.agentStyle] ?? "border-muted text-muted-foreground"
          )}>
            <Sliders className="h-3 w-3" />
            {agentSettings.agentStyle.toUpperCase()} · {agentSettings.agentTimeframe} · ≥{confidenceThreshold}%
          </div>

          <Button
            onClick={() => handleAnalyze()}
            disabled={runAgent.isPending}
            className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {runAgent.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <BrainCircuit className="mr-2 h-4 w-4" />}
            AI AGENT
          </Button>
        </div>
      </div>

      {/* Auto-run indicator */}
      {agentSettings.agentAutoRun && !autoRanOnce && (
        <div className="flex items-center gap-2 text-xs font-mono text-primary/80 border border-primary/20 bg-primary/5 rounded-sm px-3 py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Auto-Run enabled — launching agent analysis…
        </div>
      )}

      {/* Agent running */}
      {runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-mono font-bold text-sm">RUNNING AI ANALYSIS…</div>
              <div className="text-xs text-muted-foreground mt-1">
                Style: <span className="capitalize">{agentSettings.agentStyle}</span> ·
                Timeframe: {agentSettings.agentTimeframe} ·
                Instrument: {instrumentType} ·
                Tokens: {agentSettings.agentMaxTokens}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent result */}
      {agentResult && !runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-card">
          <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono">AI AGENT ANALYSIS — {agentResult.symbol}</CardTitle>
              <Badge variant="outline" className={cn("text-[10px] font-mono border", styleColors[agentSettings.agentStyle])}>
                {agentSettings.agentStyle.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                {agentSettings.agentTimeframe}
              </Badge>
              {agentSettings.agentConfidenceThreshold > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                  ≥{agentSettings.agentConfidenceThreshold}% CONF
                </Badge>
              )}
            </div>
            <button onClick={() => setAgentResult(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{agentResult.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-success/5 border border-success/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-mono font-bold text-success">SUPPORT LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.support.length > 0
                    ? agentResult.keyLevels.support.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-mono font-bold text-destructive">RESISTANCE LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.resistance.length > 0
                    ? agentResult.keyLevels.resistance.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-muted/20 border border-muted rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-mono font-bold text-warning">RISK ASSESSMENT</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{agentResult.riskAssessment}</p>
              </div>
            </div>

            {filteredSignals.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-muted-foreground font-bold tracking-wider">AI SIGNALS</div>
                  {agentResult.signals.length !== filteredSignals.length && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {agentResult.signals.length - filteredSignals.length} signal(s) filtered (below {confidenceThreshold}% confidence)
                    </div>
                  )}
                </div>
                {filteredSignals.map((sig, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-muted rounded-sm bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={cn(
                        "font-mono text-xs border-0 px-2 py-0.5 shrink-0",
                        sig.action === "BUY" ? "bg-success/20 text-success" :
                        sig.action === "SELL" ? "bg-destructive/20 text-destructive" :
                        "bg-warning/20 text-warning"
                      )}>
                        {sig.action}
                      </Badge>
                      <div>
                        <div className="font-mono font-bold text-sm">{sig.displayText}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{sig.rationale}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-muted-foreground">ENTRY: <span className="text-foreground font-bold">{sig.entryPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">TARGET: <span className="text-success font-bold">{sig.targetPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">SL: <span className="text-destructive font-bold">{sig.stopLoss ?? "—"}</span></div>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        sig.confidence > 70 ? "text-success border-success/30 bg-success/10" :
                        sig.confidence > 40 ? "text-warning border-warning/30 bg-warning/10" :
                        "text-destructive border-destructive/30 bg-destructive/10"
                      )}>
                        {sig.confidence}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : agentResult.signals.length > 0 ? (
              <div className="text-center py-4 border border-muted border-dashed rounded-sm text-xs font-mono text-muted-foreground">
                All {agentResult.signals.length} signal(s) filtered below {confidenceThreshold}% confidence threshold.
                Lower the threshold in Settings → AI Agent.
              </div>
            ) : null}

            <div className="text-[10px] font-mono text-muted-foreground/50 text-right">
              Generated at {new Date(agentResult.generatedAt).toLocaleTimeString()} · Saved to signals: {agentSettings.agentSaveSignals ? "YES" : "NO"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical indicators */}
      {loadingAnalysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : analysisError || !analysis ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {analysisError ? "Could not fetch market data. Markets may be closed or the symbol is invalid." : "Enter a valid NSE symbol and press Enter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Row 1: Signal summary ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="rounded-sm border-muted col-span-1 md:col-span-2 bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">OVERALL SIGNAL</div>
                <div className="flex items-center gap-4">
                  <div className={cn("text-4xl font-bold font-mono tracking-tight",
                    analysis.overallSignal === "BUY"  ? "text-success" :
                    analysis.overallSignal === "SELL" ? "text-destructive" : "text-warning"
                  )}>
                    {analysis.overallSignal}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-muted-foreground mb-1">STRENGTH: {analysis.signalStrength}%</div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full transition-all",
                        analysis.overallSignal === "BUY"  ? "bg-success" :
                        analysis.overallSignal === "SELL" ? "bg-destructive" : "bg-warning"
                      )} style={{ width: `${analysis.signalStrength}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">TREND</div>
                <Badge variant="outline" className={cn(
                  "font-mono text-lg py-1 px-3 w-fit border-0",
                  analysis.trend.includes("BULLISH") ? "bg-success/20 text-success" :
                  analysis.trend.includes("BEARISH") ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                )}>
                  {analysis.trend.replace("_", " ")}
                </Badge>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">RSI (14)</div>
                <div className={cn("text-3xl font-bold font-mono",
                  analysis.rsi && analysis.rsi > 70 ? "text-destructive" :
                  analysis.rsi && analysis.rsi < 30 ? "text-success" : "text-foreground"
                )}>
                  {fmt(analysis.rsi, 2)}
                </div>
                <div className="text-xs font-mono text-muted-foreground mt-1">
                  {analysis.rsi && analysis.rsi > 70 ? "OVERBOUGHT" :
                   analysis.rsi && analysis.rsi < 30 ? "OVERSOLD"   : "NEUTRAL"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 2: MACD + Moving Averages ────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MACD (12, 26, 9)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <StatRow label="MACD LINE"   value={fmt(analysis.macd?.macd, 4)} />
                <StatRow label="SIGNAL LINE" value={fmt(analysis.macd?.signal, 4)} />
                <StatRow
                  label="HISTOGRAM"
                  value={fmt(analysis.macd?.histogram, 4)}
                  color={(analysis.macd?.histogram ?? 0) > 0 ? "text-success" : "text-destructive"}
                />
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MOVING AVERAGES</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <StatRow label="SMA 20"  value={fmt(analysis.sma20)} />
                <StatRow label="SMA 50"  value={fmt(analysis.sma50)} />
                <StatRow label="SMA 200" value={fmt(analysis.sma200)} />
                <StatRow label="EMA 9"   value={fmt(analysis.ema9)} />
                <StatRow label="EMA 21"  value={fmt(analysis.ema21)} />
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: Bollinger Bands ────────────────────────────────────────── */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono">BOLLINGER BANDS (20, 2)</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                {[
                  { label: "UPPER BAND",    val: fmt(analysis.bollingerBands?.upper),  border: "border-muted" },
                  { label: "MIDDLE (SMA20)", val: fmt(analysis.bollingerBands?.middle), border: "border-primary/20" },
                  { label: "LOWER BAND",    val: fmt(analysis.bollingerBands?.lower),  border: "border-muted" },
                ].map((b) => (
                  <div key={b.label} className={cn("bg-muted/20 p-4 rounded-sm border", b.border)}>
                    <div className="text-xs font-mono text-muted-foreground mb-2">{b.label}</div>
                    <div className="font-mono font-bold text-lg">{b.val}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Section label ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono font-bold text-primary tracking-widest">ADVANCED INDICATORS</span>
            <div className="flex-1 h-px bg-primary/20" />
          </div>

          {/* ── Row 4: SuperTrend + Aroon + ADX ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SuperTrend */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  SUPERTREND (7, 3)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {analysis.superTrend ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-muted-foreground">DIRECTION</span>
                      <Badge variant="outline" className={cn(
                        "font-mono text-xs border-0 px-2 py-0.5",
                        analysis.superTrend.direction === "UP" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      )}>
                        {analysis.superTrend.direction === "UP" ? "▲ BULLISH" : "▼ BEARISH"}
                      </Badge>
                    </div>
                    <StatRow label="LEVEL" value={fmt(analysis.superTrend.value)} />
                    <div className="text-xs font-mono text-muted-foreground pt-1">
                      Price {analysis.superTrend.direction === "UP" ? "above" : "below"} SuperTrend band
                    </div>
                  </>
                ) : <div className="text-sm font-mono text-muted-foreground">Insufficient data</div>}
              </CardContent>
            </Card>

            {/* Aroon */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">AROON (14)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {analysis.aroon ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-muted-foreground">AROON UP</span>
                        <span className={cn("font-mono font-bold", analysis.aroon.up > 70 ? "text-success" : "text-foreground")}>
                          {analysis.aroon.up}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success" style={{ width: `${analysis.aroon.up}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-muted-foreground">AROON DOWN</span>
                        <span className={cn("font-mono font-bold", analysis.aroon.down > 70 ? "text-destructive" : "text-foreground")}>
                          {analysis.aroon.down}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-destructive" style={{ width: `${analysis.aroon.down}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground pt-1">
                      {analysis.aroon.up > analysis.aroon.down ? "Uptrend dominant" : "Downtrend dominant"}
                    </div>
                  </>
                ) : <div className="text-sm font-mono text-muted-foreground">Insufficient data</div>}
              </CardContent>
            </Card>

            {/* ADX + Stochastic */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">ADX & STOCHASTIC</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-muted-foreground">ADX (14)</span>
                    <span className={cn("font-mono font-bold",
                      analysis.adx != null && analysis.adx > 40 ? "text-primary" :
                      analysis.adx != null && analysis.adx > 25 ? "text-success" : "text-muted-foreground"
                    )}>
                      {analysis.adx != null ? analysis.adx.toFixed(1) : "N/A"}
                    </span>
                  </div>
                  {analysis.adx != null && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {analysis.adx > 40 ? "VERY STRONG TREND" : analysis.adx > 25 ? "STRONG TREND" : analysis.adx > 20 ? "MODERATE TREND" : "WEAK / RANGING"}
                    </div>
                  )}
                </div>
                <div className="border-t border-muted pt-4 space-y-2">
                  <StatRow
                    label="STOCH %K"
                    value={fmt(analysis.stochastic?.k, 1)}
                    color={
                      analysis.stochastic && analysis.stochastic.k > 80 ? "text-destructive" :
                      analysis.stochastic && analysis.stochastic.k < 20 ? "text-success" : undefined
                    }
                  />
                  <StatRow label="STOCH %D" value={fmt(analysis.stochastic?.d, 1)} />
                  <StatRow label="ATR (14)"  value={fmt(analysis.atr)} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 5: STC + Klinger | Volume indicators ─────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STC + Klinger */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  MOMENTUM OSCILLATORS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* STC */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-muted-foreground">STC (23, 50, 10)</span>
                    <span className={cn("font-mono font-bold text-lg",
                      analysis.stc != null && analysis.stc > 75 ? "text-success" :
                      analysis.stc != null && analysis.stc < 25 ? "text-destructive" : "text-foreground"
                    )}>
                      {analysis.stc != null ? analysis.stc.toFixed(1) : "N/A"}
                    </span>
                  </div>
                  {analysis.stc != null && (
                    <>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full transition-all",
                          analysis.stc > 75 ? "bg-success" :
                          analysis.stc < 25 ? "bg-destructive" : "bg-warning"
                        )} style={{ width: `${analysis.stc}%` }} />
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {analysis.stc > 75 ? "BULLISH MOMENTUM" :
                         analysis.stc < 25 ? "BEARISH MOMENTUM" : "NEUTRAL"}
                      </div>
                    </>
                  )}
                </div>

                {/* Klinger */}
                <div className="border-t border-muted pt-4 space-y-3">
                  <div className="text-xs font-mono text-muted-foreground font-bold tracking-wider">KLINGER (34, 55, 13)</div>
                  {analysis.klinger ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-muted-foreground">KVO</span>
                        <span className={cn("font-mono font-bold",
                          analysis.klinger.kvo > analysis.klinger.signal ? "text-success" : "text-destructive"
                        )}>
                          {analysis.klinger.kvo.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-muted-foreground">SIGNAL</span>
                        <span className="font-mono font-bold">{analysis.klinger.signal.toLocaleString()}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {analysis.klinger.kvo > analysis.klinger.signal ? "KVO above signal — bullish" : "KVO below signal — bearish"}
                      </div>
                    </>
                  ) : <div className="text-sm font-mono text-muted-foreground">Insufficient data (needs 60+ bars)</div>}
                </div>
              </CardContent>
            </Card>

            {/* VWAP + OBV + Session POC */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  VOLUME INDICATORS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <StatRow label="VWAP" value={fmt(analysis.vwap)} />
                <StatRow label="OBV" value={analysis.obv != null ? analysis.obv.toLocaleString() : "N/A"} />
                <StatRow label="SESSION POC" value={fmt(analysis.sessionPOC)} />
                {analysis.vwap != null && (
                  <div className="pt-2 border-t border-muted">
                    <div className="text-xs font-mono text-muted-foreground">
                      VWAP acts as dynamic support/resistance. Price {
                        analysis.sma20 && analysis.vwap
                          ? analysis.sma20 > analysis.vwap ? "above VWAP (bullish bias)" : "below VWAP (bearish bias)"
                          : "relative to VWAP"
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Row 6: Fibonacci Retracements ────────────────────────────────── */}
          {analysis.fibonacci && (
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">FIBONACCI RETRACEMENT LEVELS (50-bar range)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 md:grid-cols-7 gap-3 text-center">
                  {[
                    { label: "HIGH",  val: fmt(analysis.fibonacci.high),  border: "border-success/30", text: "text-success" },
                    { label: "78.6%", val: fmt(analysis.fibonacci.r786),  border: "border-muted", text: "" },
                    { label: "61.8%", val: fmt(analysis.fibonacci.r618),  border: "border-primary/30", text: "text-primary" },
                    { label: "50.0%", val: fmt(analysis.fibonacci.r500),  border: "border-primary/20", text: "text-primary" },
                    { label: "38.2%", val: fmt(analysis.fibonacci.r382),  border: "border-primary/30", text: "text-primary" },
                    { label: "23.6%", val: fmt(analysis.fibonacci.r236),  border: "border-muted", text: "" },
                    { label: "LOW",   val: fmt(analysis.fibonacci.low),   border: "border-destructive/30", text: "text-destructive" },
                  ].map((f) => (
                    <div key={f.label} className={cn("bg-muted/20 p-3 rounded-sm border", f.border)}>
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">{f.label}</div>
                      <div className={cn("font-mono font-bold text-sm", f.text)}>{f.val}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs font-mono text-muted-foreground">
                  Key support/resistance: 38.2%, 50%, 61.8% are the most watched retracement levels
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Row 7: India VIX gauge ────────────────────────────────────────── */}
          {analysis.indiaVix != null && (
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <Waves className="h-3.5 w-3.5 text-primary" />
                  INDIA VIX — VOLATILITY GAUGE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center gap-8">
                  <div>
                    <div className={cn("text-5xl font-bold font-mono",
                      analysis.indiaVix > 20 ? "text-destructive" :
                      analysis.indiaVix > 15 ? "text-warning" : "text-success"
                    )}>
                      {analysis.indiaVix.toFixed(2)}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">
                      {analysis.indiaVix > 25 ? "EXTREME FEAR" :
                       analysis.indiaVix > 20 ? "HIGH FEAR" :
                       analysis.indiaVix > 15 ? "ELEVATED" :
                       analysis.indiaVix > 12 ? "NORMAL" : "LOW VOLATILITY"}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs font-mono text-muted-foreground">
                      <span>LOW (&lt;12)</span>
                      <span>NORMAL (12–15)</span>
                      <span>HIGH (&gt;20)</span>
                    </div>
                    <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-success via-warning to-destructive" />
                      <div
                        className="absolute top-0 h-full w-1 bg-white rounded-full shadow"
                        style={{ left: `${Math.min(Math.max(((analysis.indiaVix - 8) / 22) * 100, 0), 100)}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      India VIX measures expected market volatility over the next 30 days. Above 20 = options expensive.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
