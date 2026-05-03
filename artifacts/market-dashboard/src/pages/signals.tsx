import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSignals, 
  getGetSignalsQueryKey, 
  useGenerateSignals,
  GetSignalsType,
  GetSignalsAction,
  GetSignalsStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignalsBoard() {
  const [type, setType] = useState<GetSignalsType | "ALL">("ALL");
  const [action, setAction] = useState<GetSignalsAction | "ALL">("ALL");
  const [status, setStatus] = useState<GetSignalsStatus | "ALL">("ACTIVE");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: signals, isLoading } = useGetSignals({ 
    type: type === "ALL" ? undefined : type, 
    action: action === "ALL" ? undefined : action, 
    status: status === "ALL" ? undefined : status 
  }, {
    query: {
      queryKey: getGetSignalsQueryKey({ type: type === "ALL" ? undefined : type, action: action === "ALL" ? undefined : action, status: status === "ALL" ? undefined : status })
    }
  });

  const generateSignals = useGenerateSignals();

  const handleGenerate = () => {
    generateSignals.mutate({ data: { timeframe: "INTRADAY" } }, {
      onSuccess: () => {
        toast({
          title: "Signals Generated",
          description: "New trading signals have been generated successfully.",
        });
        queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to generate signals.",
          variant: "destructive"
        });
      }
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey() });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">SIGNALS BOARD</h1>
        <Button 
          onClick={handleGenerate} 
          disabled={generateSignals.isPending}
          className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {generateSignals.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TerminalSquare className="mr-2 h-4 w-4" />}
          GENERATE SIGNALS
        </Button>
      </div>

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
                      <div className="font-mono font-bold">{signal.entryPrice || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">TARGET</div>
                      <div className="font-mono font-bold text-success">{signal.targetPrice || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-mono mb-1">STOP LOSS</div>
                      <div className="font-mono font-bold text-destructive">{signal.stopLoss || '-'}</div>
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
            <p className="text-muted-foreground text-sm mb-4">There are no signals matching your current filters.</p>
            <Button onClick={handleGenerate} variant="outline" className="font-mono">GENERATE NEW SIGNALS</Button>
          </div>
        )}
      </div>
    </div>
  );
}
