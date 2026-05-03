import { Activity, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isMarketOpen: boolean;
  isPreOpen?: boolean;
  lastUpdatedIST: string;
  countdown: number;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
};

export function LiveRefreshBar({
  isMarketOpen,
  isPreOpen,
  lastUpdatedIST,
  countdown,
  onRefresh,
  isRefreshing,
  className,
}: Props) {
  const statusColor = isMarketOpen
    ? "text-green-400"
    : isPreOpen
    ? "text-yellow-400"
    : "text-muted-foreground";

  const statusLabel = isMarketOpen
    ? "MARKET OPEN"
    : isPreOpen
    ? "PRE-OPEN"
    : "MARKET CLOSED";

  return (
    <div
      className={cn(
        "flex items-center gap-3 text-[11px] font-mono text-muted-foreground",
        className
      )}
    >
      <div className={cn("flex items-center gap-1.5", statusColor)}>
        <Activity
          className={cn("h-3.5 w-3.5", isMarketOpen && "animate-pulse")}
        />
        {statusLabel}
      </div>

      <span className="text-muted-foreground/25">|</span>

      <div className="flex items-center gap-1 tabular-nums">
        <Clock className="h-3 w-3" />
        <span>{lastUpdatedIST} IST</span>
      </div>

      <div
        className={cn(
          "tabular-nums transition-colors",
          countdown <= 5 ? "text-primary font-bold" : "text-muted-foreground"
        )}
      >
        {countdown}s
      </div>

      <button
        onClick={onRefresh}
        className="flex items-center gap-1 border border-muted rounded-sm px-2 py-0.5 hover:text-primary hover:border-primary transition-colors"
        title="Refresh now"
      >
        <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
        NOW
      </button>
    </div>
  );
}
