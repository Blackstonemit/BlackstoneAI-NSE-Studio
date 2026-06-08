import { useState } from "react";
import { usePaperTrade, getLotSize, type Direction } from "@/hooks/use-paper-trade";
import { cn } from "@/lib/utils";

interface TradeButtonsProps {
  symbol: string;
  price: number;
  className?: string;
}

/** Compact inline [BUY] [SELL] pair — drop this into any table row or card. */
export function TradeButtons({ symbol, price, className }: TradeButtonsProps) {
  const { addPosition, state, closePosition } = usePaperTrade();
  const [flash, setFlash] = useState<"buy" | "sell" | null>(null);

  const openPos = state.positions.find((p) => p.symbol === symbol);

  function trade(dir: Direction) {
    const entry = price > 0 ? price : 1;
    addPosition({ symbol, direction: dir, lots: 1, lotSize: getLotSize(symbol), entryPrice: entry });
    setFlash(dir === "BUY" ? "buy" : "sell");
    setTimeout(() => setFlash(null), 400);
  }

  function exit() {
    if (!openPos) return;
    const exitPrice = price > 0 ? price : openPos.entryPrice;
    closePosition(openPos.id, exitPrice);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => trade("BUY")}
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-sm border transition-all leading-none",
          flash === "buy"
            ? "bg-success text-black border-success scale-95"
            : "bg-success/15 text-success border-success/40 hover:bg-success/30"
        )}
      >B</button>
      <button
        onClick={() => trade("SELL")}
        className={cn(
          "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-sm border transition-all leading-none",
          flash === "sell"
            ? "bg-destructive text-white border-destructive scale-95"
            : "bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/30"
        )}
      >S</button>
      {openPos && (
        <button
          onClick={exit}
          className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-sm border border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/30 transition-colors leading-none"
        >X</button>
      )}
    </div>
  );
}

interface SignalTradeButtonProps {
  symbol: string;
  price: number | null;
  direction: "BUY" | "SELL" | "EXIT";
}

/** One-click button that follows a signal's recommended direction. */
export function SignalTradeButton({ symbol, price, direction }: SignalTradeButtonProps) {
  const { addPosition, state, closePosition } = usePaperTrade();
  const [flash, setFlash] = useState(false);

  const openPos = state.positions.find((p) => p.symbol === symbol);
  const entry = price && price > 0 ? price : 1;
  const isBuy = direction === "BUY";

  function handle() {
    if (direction === "EXIT" && openPos) {
      closePosition(openPos.id, entry);
    } else if (direction !== "EXIT") {
      addPosition({ symbol, direction, lots: 1, lotSize: getLotSize(symbol), entryPrice: entry });
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
  }

  return (
    <button
      onClick={handle}
      className={cn(
        "px-2.5 py-1 text-[10px] font-mono font-bold rounded-sm border tracking-wider transition-all",
        flash ? "scale-95 opacity-70" : "",
        direction === "BUY"
          ? "bg-success/15 text-success border-success/40 hover:bg-success/30"
          : direction === "SELL"
            ? "bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/30"
            : "bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/30"
      )}
    >
      {direction === "EXIT" ? "EXIT" : isBuy ? "▲ TRADE BUY" : "▼ TRADE SELL"}
    </button>
  );
}
