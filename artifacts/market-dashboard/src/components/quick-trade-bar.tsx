import { useState } from "react";
import { usePaperTrade, getLotSize, type Direction } from "@/hooks/use-paper-trade";
import { useGetFutures } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, X } from "lucide-react";

const SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "ICICIBANK"];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

export function QuickTradeBar() {
  const { state, addPosition, closePosition, openPanel } = usePaperTrade();
  const { data: futures } = useGetFutures();

  const [symbol, setSymbol] = useState("NIFTY");
  const [lots, setLots] = useState(1);
  const [flash, setFlash] = useState<"buy" | "sell" | null>(null);

  // Build prices map from futures feed
  const prices: Record<string, number> = {};
  if (futures) {
    for (const f of futures) {
      const s = f.symbol.toUpperCase();
      if (!(s in prices) && f.ltp > 0) prices[s] = f.ltp;
    }
  }

  const ltp = prices[symbol] ?? 0;
  const lotSize = getLotSize(symbol);

  function trade(dir: Direction) {
    const price = ltp > 0 ? ltp : 1;
    addPosition({ symbol, direction: dir, lots, lotSize, entryPrice: price });
    setFlash(dir === "BUY" ? "buy" : "sell");
    setTimeout(() => setFlash(null), 400);
  }

  function exitAll(id: string, sym: string) {
    const exitPrice = prices[sym] ?? 0;
    closePosition(id, exitPrice > 0 ? exitPrice : 1);
  }

  const { positions } = state;

  return (
    <div className="fixed bottom-0 left-64 right-0 z-20 h-12 bg-sidebar border-t border-sidebar-border flex items-center gap-0 font-mono text-xs select-none">
      {/* ── Symbol picker ── */}
      <div className="flex items-center gap-1 px-3 border-r border-sidebar-border h-full overflow-x-auto scrollbar-none shrink-0">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={cn(
              "px-2 py-0.5 rounded-sm border text-[10px] whitespace-nowrap transition-colors",
              symbol === s
                ? "bg-primary/20 text-primary border-primary"
                : "border-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Lot counter ── */}
      <div className="flex items-center gap-1 px-3 border-r border-sidebar-border h-full shrink-0">
        <button
          onClick={() => setLots((l) => Math.max(1, l - 1))}
          className="w-5 h-5 flex items-center justify-center border border-muted rounded-sm text-muted-foreground hover:text-foreground hover:border-primary/50"
        >−</button>
        <span className="w-6 text-center font-bold">{lots}</span>
        <button
          onClick={() => setLots((l) => l + 1)}
          className="w-5 h-5 flex items-center justify-center border border-muted rounded-sm text-muted-foreground hover:text-foreground hover:border-primary/50"
        >+</button>
        <span className="text-muted-foreground/60 ml-1">L</span>
      </div>

      {/* ── LTP ── */}
      <div className="px-3 border-r border-sidebar-border h-full flex items-center shrink-0">
        <span className="text-foreground font-bold">
          {ltp > 0 ? `₹${fmt(ltp)}` : <span className="text-muted-foreground">—</span>}
        </span>
      </div>

      {/* ── BUY / SELL ── */}
      <div className="flex items-center gap-2 px-3 border-r border-sidebar-border h-full shrink-0">
        <button
          onClick={() => trade("BUY")}
          className={cn(
            "flex items-center gap-1 px-3 h-7 rounded-sm font-bold text-[11px] tracking-wider transition-all",
            flash === "buy"
              ? "bg-success text-black scale-95"
              : "bg-success/20 text-success border border-success/50 hover:bg-success/30"
          )}
        >
          <TrendingUp className="h-3 w-3" /> BUY
        </button>
        <button
          onClick={() => trade("SELL")}
          className={cn(
            "flex items-center gap-1 px-3 h-7 rounded-sm font-bold text-[11px] tracking-wider transition-all",
            flash === "sell"
              ? "bg-destructive text-white scale-95"
              : "bg-destructive/20 text-destructive border border-destructive/50 hover:bg-destructive/30"
          )}
        >
          <TrendingDown className="h-3 w-3" /> SELL
        </button>
      </div>

      {/* ── Open positions → EXIT chips ── */}
      <div className="flex items-center gap-1.5 px-3 flex-1 overflow-x-auto scrollbar-none h-full">
        {positions.length === 0 ? (
          <span className="text-muted-foreground/40 text-[10px]">NO OPEN POSITIONS</span>
        ) : (
          positions.map((pos) => {
            const posLtp = prices[pos.symbol] ?? pos.entryPrice;
            const sign = pos.direction === "BUY" ? 1 : -1;
            const pnl = sign * (posLtp - pos.entryPrice) * pos.lots * pos.lotSize;
            const isPos = pnl >= 0;
            return (
              <div
                key={pos.id}
                className={cn(
                  "flex items-center gap-1.5 pl-2 pr-1 h-7 rounded-sm border text-[10px] whitespace-nowrap shrink-0",
                  isPos ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
                )}
              >
                <span className={cn("font-bold", pos.direction === "BUY" ? "text-success" : "text-destructive")}>
                  {pos.direction === "BUY" ? "▲" : "▼"}
                </span>
                <span className="text-foreground font-bold">{pos.symbol}</span>
                <span className="text-muted-foreground">{pos.lots}L</span>
                <span className={cn("font-bold", isPos ? "text-success" : "text-destructive")}>
                  {pnl >= 0 ? "+" : ""}₹{fmt(Math.abs(pnl))}
                </span>
                <button
                  onClick={() => exitAll(pos.id, pos.symbol)}
                  title="Exit position"
                  className="ml-0.5 px-1.5 h-5 rounded-sm bg-destructive/20 text-destructive hover:bg-destructive hover:text-white border border-destructive/40 font-bold text-[9px] tracking-wider transition-colors"
                >
                  EXIT
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Paper trade panel shortcut ── */}
      <button
        onClick={openPanel}
        className="px-3 h-full border-l border-sidebar-border text-amber-400/70 hover:text-amber-400 text-[10px] tracking-wider shrink-0 transition-colors"
      >
        PAPER▸
      </button>
    </div>
  );
}
