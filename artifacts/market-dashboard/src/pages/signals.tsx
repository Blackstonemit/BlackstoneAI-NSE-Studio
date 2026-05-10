import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSignals, 
  getGetSignalsQueryKey, 
  useGenerateSignals,
  GetSignalsType,
  GetSignalsAction,
  GetSignalsStatus
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { useSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TerminalSquare, Cpu, BrainCircuit, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

function SchedulerBar({
  onExpire,
  onGenerate,
  isGenerating,
}: {
  onExpire: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const { settings } = useSettings();

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground border border-muted/40 rounded-sm px-3 py-1.5 bg-muted/5">
      <div className="flex items-center gap-1.5 text-primary/80">
        <BrainCircuit className="h-3.5 w-3.5" />
        AI SCHEDULER
      </div>
      <span className="text-muted-foreground/25">|</span>
      <span>
        Auto-generate:{" "}
        <span className={settings.agentAutoGenerate ? "text-green-400 font-bold" : "text-muted-foreground/50"}>
          {settings.agentAutoGenerate ? "ON" : "OFF"}
        </span>
      </span>
      <span className="text-muted-foreground/25">|</span>
      <span className="text-muted-foreground/60">Every 30 min during market hours</span>
      <span className="text-muted-foreground/25">|</span>
      <button
        onClick={onExpire}
        className="flex items-center gap-1 border border-muted rounded-sm px-2 py-0.5 hover:text-yellow-400 hover:border-yellow-500/40 transition-colors"
        title="Expire stale signals now"
      >
        <Clock3 className="h-3 w-3" />
        EXPIRE NOW
      </button>
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="flex items-center gap-1 border border-muted rounded-sm px-2 py-0.5 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40"
        title="Generate signals now via AI scheduler"
      >
        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />}
        RUN NOW
      </button>
    </div>
  );
}

export default function SignalsBoard() {
  const [type, setType] = useState<GetSignalsType | "ALL">("ALL");
  const [action, setAction] = useState<GetSignalsAction | "ALL">("ALL");
  const [status, setStatus] = useState<GetSignalsStatus | "ALL">("ACTIVE");
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: signals, isLoading } = useGetSignals({ 
    type: type === "ALL" ? undefined : type, 
    action: action === "ALL" ? undefined : action, 
    status: status === "ALL" ? undefined : status 
  }, {
    query: {
      queryKey: getGetSignalsQueryKey({ type: type === "ALL" ? undefined : type, action: action === "ALL" ? undefined : action, status: status === "ALL" ? undefined : status }) as any
    }
  });

  const generateSignals = useGenerateSignals();

  const handleGenerate = () => {
    generateSignals.mutate({ data: { timeframe: "INTRADAY" } }, {
      onSuccess: () => {
        toast({ title: "Signals Generated", description: "New trading signals have been generated." });
        queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to generate signals.", variant: "destructive" });
      }
    });
  };

  const handleSchedulerExpire = async () => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/scheduler/expire`, { method: "POST" });
      const data = await res.json() as { expired: number };
      toast({ title: "Expiry Complete", description: `${data.expired} signal(s) marked as EXPIRED.` });
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
    } catch {
      toast({ title: "Error", description: "Expiry request failed.", variant: "destructive" });
    }
  };

  const handleSchedulerGenerate = async () => {
    setSchedulerRunning(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/scheduler/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json() as { generated: number };
      if (data.generated > 0) {
        toast({ title: "AI Signals Generated", description: `${data.generated} new signal(s) created by AI scheduler.` });
        queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
      } else {
        toast({ title: "No Signals Generated", description: "Market may be closed or AI returned no results.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Scheduler generate failed.", variant: "destructive" });
    } finally {
      setSchedulerRunning(false);
    }
  };

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, paused, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight font-mono">SIGNALS BOARD</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            paused={paused}
            onRefresh={refresh}
          />
          <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground border border-muted rounded-sm px-2 py-1">
            <Cpu className="h-3 w-3 text-success" />
            OPENAI GPT-5.4
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generateSignals.isPending}
            className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {generateSignals.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TerminalSquare className="mr-2 h-4 w-4" />}
            GENERATE SIGNALS
          </Button>
        </div>
      </div>

      <SchedulerBar
        onExpire={handleSchedulerExpire}
        onGenerate={handleSchedulerGenerate}
        isGenerating={schedulerRunning}
      />

      <div className="flex gap-4">
        <Select value={type} onValueChange={(v: GetSignalsType | "ALL") => setType(v)}>
          <SelectTrigger className="w-[180px] font-mono border-muted bg-card">
            <SelectValue placeholder="TYPE" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL TYPES</SelectItem>
            <SelectItem value="STOCK">STOCK</SelectItem>
            <SelectItem value="OPTIONS">OPTIONS</SelectItem>
            <SelectItem value="FUTURES">FUTURES</SelectItem>
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={(v: GetSignalsAction | "ALL") => setAction(v)}>
          <SelectTrigger className="w-[180px] font-mono border-muted bg-card">
            <SelectValue placeholder="ACTION" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL ACTIONS</SelectItem>
            <SelectItem value="BUY">BUY</SelectItem>
            <SelectItem value="SELL">SELL</SelectItem>
            <SelectItem value="EXIT">EXIT</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v: GetSignalsStatus | "ALL") => setStatus(v)}>
          <SelectTrigger className="w-[180px] font-mono border-muted bg-card">
            <SelectValue placeholder="STATUS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL STATUS</SelectItem>
            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
            <SelectItem value="TRIGGERED">TRIGGERED</SelectItem>
            <SelectItem value="EXPIRED">EXPIRED</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="rounded-sm border-muted">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : signals && signals.length > 0 ? (
          signals.map(signal => (
            <Card key={signal.id} className="rounded-sm border-muted bg-card hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={cn(
                        "font-mono text-sm border-0 px-3 py-1",
                        signal.action === "BUY" ? "bg-success/20 text-success" : 
                        signal.action === "SELL" ? "bg-destructive/20 text-destructive" : 
                        "bg-warning/20 text-warning"
                      )}>
                        {signal.action}
                      </Badge>
                      <span className="font-bold text-lg tracking-tight">{signal.displayText}</span>
                      <Badge variant="secondary" className="font-mono text-xs">{signal.timeframe}</Badge>
                      <Badge variant="outline" className="font-mono text-xs border-muted">{signal.instrumentType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-2xl">{signal.rationale}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6 bg-muted/20 p-4 rounded-sm border border-muted">
                    <div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">ENTRY</div>
                      <div className="font-mono font-bold">{signal.entryPrice ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">TARGET</div>
                      <div className="font-mono font-bold text-success">{signal.targetPrice ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">STOP LOSS</div>
                      <div className="font-mono font-bold text-destructive">{signal.stopLoss ?? '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-muted flex items-center justify-between">
                  <div className="flex items-center gap-2 w-64">
                    <span className="text-xs font-mono text-muted-foreground">CONFIDENCE</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", signal.confidence > 70 ? "bg-success" : signal.confidence > 40 ? "bg-warning" : "bg-destructive")} 
                        style={{ width: `${signal.confidence}%` }} 
                      />
                    </div>
                    <span className="text-xs font-mono font-bold">{signal.confidence}%</span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    CREATED: {new Date(signal.createdAt).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center border border-muted border-dashed rounded-sm">
            <h3 className="text-lg font-mono font-bold mb-2">NO SIGNALS FOUND</h3>
            <p className="text-muted-foreground text-sm mb-4">No signals match your current filters.</p>
            <Button onClick={handleGenerate} variant="outline" className="font-mono">GENERATE NEW SIGNALS</Button>
          </div>
        )}
      </div>
    </div>
  );
}
