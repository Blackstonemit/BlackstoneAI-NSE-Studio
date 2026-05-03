import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMarketIndices,
  getGetMarketIndicesQueryKey,
  useGetMarketMovers,
  getGetMarketMoversQueryKey,
  useGetAnalysisSummary,
  getGetAnalysisSummaryQueryKey,
  useGetSignals,
  getGetSignalsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: indices, isLoading: loadingIndices } = useGetMarketIndices();
  const { data: movers, isLoading: loadingMovers } = useGetMarketMovers();
  const { data: summary, isLoading: loadingSummary } = useGetAnalysisSummary();
  const { data: signals, isLoading: loadingSignals } = useGetSignals({ status: "ACTIVE" });

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetMarketIndicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMarketMoversQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey({ status: "ACTIVE" }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Compute NSE market status based on IST (UTC+5:30)
  const isMarketOpen = (() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);
    const day = ist.getUTCDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;
    const h = ist.getUTCHours();
    const m = ist.getUTCMinutes();
    const mins = h * 60 + m;
    return mins >= 555 && mins < 930; // 9:15 AM to 3:30 PM IST
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">LIVE DASHBOARD</h1>
        <div className={`flex items-center gap-2 text-xs font-mono ${isMarketOpen ? "text-success" : "text-muted-foreground"}`}>
          <Activity className={`h-4 w-4 ${isMarketOpen ? "text-success animate-pulse" : "text-muted-foreground"}`} />
          {isMarketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
        </div>
      </div>

      {/* Indices Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingIndices ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-sm border-muted">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          indices?.map((idx) => (
            <Card key={idx.symbol} className="rounded-sm border-muted bg-card">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="text-sm font-medium text-muted-foreground">{idx.name}</div>
                <div className="flex items-baseline justify-between mt-2">
                  <div className="text-2xl font-bold font-mono">{idx.value.toFixed(2)}</div>
                  <div className={cn("flex items-center text-sm font-mono", idx.change >= 0 ? "text-success" : "text-destructive")}>
                    {idx.change >= 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {Math.abs(idx.changePercent).toFixed(2)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Analysis Summary */}
        <Card className="rounded-sm border-muted col-span-1">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">MARKET BREADTH</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loadingSummary ? (
              <Skeleton className="h-32 w-full" />
            ) : summary ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Analyzed</span>
                  <span className="font-mono">{summary.totalSymbols}</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                  <div style={{ width: `${(summary.bullish / summary.totalSymbols) * 100}%` }} className="bg-success" />
                  <div style={{ width: `${(summary.neutral / summary.totalSymbols) * 100}%` }} className="bg-muted" />
                  <div style={{ width: `${(summary.bearish / summary.totalSymbols) * 100}%` }} className="bg-destructive" />
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-success">{summary.bullish} BULLISH</span>
                  <span className="text-muted-foreground">{summary.neutral} NEUTRAL</span>
                  <span className="text-destructive">{summary.bearish} BEARISH</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Top Movers */}
        <Card className="rounded-sm border-muted col-span-1 md:col-span-2">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">TOP GAINERS / LOSERS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMovers ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : movers ? (
              <div className="grid grid-cols-2 divide-x divide-muted">
                <div className="p-2 space-y-1">
                  {movers.gainers.slice(0, 5).map(g => (
                    <div key={g.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{g.symbol}</span>
                      <span className="text-success font-mono text-sm">+{g.changePercent.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div className="p-2 space-y-1">
                  {movers.losers.slice(0, 5).map(l => (
                    <div key={l.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{l.symbol}</span>
                      <span className="text-destructive font-mono text-sm">{l.changePercent.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Signals Feed */}
      <Card className="rounded-sm border-muted">
        <CardHeader className="p-4 border-b border-muted">
          <CardTitle className="text-sm font-mono">ACTIVE SIGNALS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSignals ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : signals && signals.length > 0 ? (
            <div className="divide-y divide-muted">
              {signals.slice(0, 10).map(signal => (
                <div key={signal.id} className="p-4 flex items-center justify-between hover:bg-muted/20">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn(
                      "font-mono rounded-sm border-0 px-2 py-1",
                      signal.action === "BUY" ? "bg-success/20 text-success" : 
                      signal.action === "SELL" ? "bg-destructive/20 text-destructive" : 
                      "bg-warning/20 text-warning"
                    )}>
                      {signal.action}
                    </Badge>
                    <div>
                      <div className="font-bold">{signal.displayText}</div>
                      <div className="text-xs text-muted-foreground mt-1">{signal.rationale}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div className="text-xs font-mono text-muted-foreground">
                      ENTRY: {signal.entryPrice ?? '-'}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      TARGET: <span className="text-success">{signal.targetPrice ?? '-'}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      SL: <span className="text-destructive">{signal.stopLoss ?? '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">
              NO ACTIVE SIGNALS
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
