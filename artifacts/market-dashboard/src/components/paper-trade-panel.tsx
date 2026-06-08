import { useState, useEffect, useRef } from "react";
import { usePaperTrade, getLotSize, type Direction } from "@/hooks/use-paper-trade";
import { useGetFutures } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  ChevronRight,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
const fmtPnl = (n: number) =>
  `${n >= 0 ? "+" : ""}₹${fmt(Math.abs(n))}`;
const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
};

// Common futures symbols for quick-pick
const QUICK_SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "ICICIBANK", "AXISBANK"];

// ── New Trade Form ─────────────────────────────────────────────────────────────
function NewTradeForm({ prices }: { prices: Record<string, number> }) {
  const { addPosition } = usePaperTrade();
  const [symbol, setSymbol] = useState("NIFTY");
  const [customSymbol, setCustomSymbol] = useState("");
  const [direction, setDirection] = useState<Direction>("BUY");
  const [lots, setLots] = useState(1);
  const [priceInput, setPriceInput] = useState("");
  const [useMarket, setUseMarket] = useState(true);

  const activeSymbol = customSymbol.trim().toUpperCase() || symbol;
  const lotSize = getLotSize(activeSymbol);
  const marketPrice = prices[activeSymbol] ?? 0;
  const entryPrice = useMarket ? marketPrice : parseFloat(priceInput) || 0;
  const margin = entryPrice * lots * lotSize * 0.1; // rough 10% SPAN margin estimate

  function handleSubmit() {
    if (!activeSymbol || entryPrice <= 0 || lots < 1) return;
    addPosition({ symbol: activeSymbol, direction, lots, lotSize, entryPrice });
    setCustomSymbol("");
    setPriceInput("");
    setUseMarket(true);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Symbol quick-pick */}
      <div>
        <div className="text-xs text-muted-foreground font-mono mb-2">SYMBOL</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK_SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => { setSymbol(s); setCustomSymbol(""); }}
              className={cn(
                "px-2 py-0.5 text-xs font-mono rounded-sm border transition-colors",
                activeSymbol === s && !customSymbol
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-muted text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Input
          className="font-mono text-xs h-8 uppercase bg-card border-muted"
          placeholder="OR TYPE CUSTOM SYMBOL..."
          value={customSymbol}
          onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
        />
      </div>

      {/* Direction */}
      <div>
        <div className="text-xs text-muted-foreground font-mono mb-2">DIRECTION</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection("BUY")}
            className={cn(
              "py-2 font-mono text-sm font-bold rounded-sm border transition-colors flex items-center justify-center gap-1",
              direction === "BUY"
                ? "bg-success/20 text-success border-success"
                : "border-muted text-muted-foreground hover:border-success/50"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" /> BUY
          </button>
          <button
            onClick={() => setDirection("SELL")}
            className={cn(
              "py-2 font-mono text-sm font-bold rounded-sm border transition-colors flex items-center justify-center gap-1",
              direction === "SELL"
                ? "bg-destructive/20 text-destructive border-destructive"
                : "border-muted text-muted-foreground hover:border-destructive/50"
            )}
          >
            <TrendingDown className="h-3.5 w-3.5" /> SELL
          </button>
        </div>
      </div>

      {/* Lots */}
      <div>
        <div className="text-xs text-muted-foreground font-mono mb-2">
          LOTS <span className="text-muted-foreground/60">(1 lot = {lotSize} units)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLots((l) => Math.max(1, l - 1))}
            className="w-8 h-8 rounded-sm border border-muted text-muted-foreground hover:border-primary/50 hover:text-foreground font-mono"
          >−</button>
          <Input
            type="number"
            min={1}
            value={lots}
            onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
            className="flex-1 font-mono text-sm h-8 text-center bg-card border-muted"
          />
          <button
            onClick={() => setLots((l) => l + 1)}
            className="w-8 h-8 rounded-sm border border-muted text-muted-foreground hover:border-primary/50 hover:text-foreground font-mono"
          >+</button>
        </div>
      </div>

      {/* Price */}
      <div>
        <div className="text-xs text-muted-foreground font-mono mb-2">ENTRY PRICE</div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setUseMarket(true)}
            className={cn(
              "flex-1 py-1 text-xs font-mono rounded-sm border transition-colors",
              useMarket ? "bg-primary/20 text-primary border-primary" : "border-muted text-muted-foreground hover:border-primary/50"
            )}
          >
            MARKET {marketPrice > 0 ? `(₹${fmt(marketPrice)})` : "(–)"}
          </button>
          <button
            onClick={() => setUseMarket(false)}
            className={cn(
              "flex-1 py-1 text-xs font-mono rounded-sm border transition-colors",
              !useMarket ? "bg-primary/20 text-primary border-primary" : "border-muted text-muted-foreground hover:border-primary/50"
            )}
          >
            LIMIT
          </button>
        </div>
        {!useMarket && (
          <Input
            type="number"
            className="font-mono text-sm h-8 bg-card border-muted"
            placeholder="Enter price..."
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
          />
        )}
      </div>

      {/* Summary row */}
      <div className="rounded-sm bg-muted/20 border border-muted px-3 py-2 text-xs font-mono space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">QTY</span>
          <span>{lots * lotSize} units</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">ENTRY</span>
          <span>₹{entryPrice > 0 ? fmt(entryPrice) : "–"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">EST. MARGIN</span>
          <span>₹{margin > 0 ? fmt(margin) : "–"}</span>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={entryPrice <= 0 || lots < 1}
        className={cn(
          "w-full font-mono font-bold tracking-wider",
          direction === "BUY"
            ? "bg-success hover:bg-success/90 text-black"
            : "bg-destructive hover:bg-destructive/90 text-white"
        )}
      >
        {direction} {activeSymbol} FUT
      </Button>
    </div>
  );
}

// ── Positions Tab ─────────────────────────────────────────────────────────────
function PositionsTab({ prices }: { prices: Record<string, number> }) {
  const { state, closePosition } = usePaperTrade();
  const { positions } = state;

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground font-mono text-xs">
        NO OPEN POSITIONS
      </div>
    );
  }

  return (
    <div className="divide-y divide-muted">
      {positions.map((pos) => {
        const ltp = prices[pos.symbol] ?? pos.entryPrice;
        const sign = pos.direction === "BUY" ? 1 : -1;
        const pnl = sign * (ltp - pos.entryPrice) * pos.lots * pos.lotSize;
        const pnlPct = ((ltp - pos.entryPrice) / pos.entryPrice) * 100 * sign;
        const isPositive = pnl >= 0;

        return (
          <div key={pos.id} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-sm">{pos.symbol}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-mono",
                      pos.direction === "BUY" ? "border-success text-success" : "border-destructive text-destructive"
                    )}
                  >
                    {pos.direction}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">FUT</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {pos.lots}L × {pos.lotSize} @ ₹{fmt(pos.entryPrice)}
                </div>
              </div>
              <div className="text-right">
                <div className={cn("font-mono font-bold text-sm", isPositive ? "text-success" : "text-destructive")}>
                  {fmtPnl(pnl)}
                </div>
                <div className={cn("text-[11px] font-mono", isPositive ? "text-success/70" : "text-destructive/70")}>
                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground font-mono">
                LTP: <span className="text-foreground">₹{fmt(ltp)}</span>
                <span className="ml-2 text-muted-foreground/50">{fmtTime(pos.entryTime)}</span>
              </div>
              <button
                onClick={() => closePosition(pos.id, ltp)}
                className="text-[11px] font-mono px-2 py-0.5 border border-muted rounded-sm text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
              >
                CLOSE @ MKT
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const { state } = usePaperTrade();
  const { history } = state;

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground font-mono text-xs">
        NO CLOSED TRADES YET
      </div>
    );
  }

  return (
    <div className="divide-y divide-muted">
      {history.map((t) => {
        const isPositive = t.pnl >= 0;
        return (
          <div key={t.id} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-sm">{t.symbol}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-mono",
                      t.direction === "BUY" ? "border-success text-success" : "border-destructive text-destructive"
                    )}
                  >
                    {t.direction}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {t.lots}L · ₹{fmt(t.entryPrice)} → ₹{fmt(t.exitPrice)}
                  <span className="ml-2 text-muted-foreground/50">{fmtTime(t.exitTime)}</span>
                </div>
              </div>
              <div className={cn("font-mono font-bold text-sm", isPositive ? "text-success" : "text-destructive")}>
                {fmtPnl(t.pnl)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function PaperTradePanel() {
  const { state, closePanel, reset, totalUnrealizedPnl } = usePaperTrade();
  const { data: futures } = useGetFutures();

  // Build a prices map: symbol → nearest expiry LTP
  const prices: Record<string, number> = {};
  if (futures) {
    for (const f of futures) {
      const sym = f.symbol.toUpperCase();
      if (!(sym in prices) || f.ltp > 0) prices[sym] = f.ltp;
    }
  }

  const unrealized = totalUnrealizedPnl(prices);
  const realized = state.history.reduce((s, t) => s + t.pnl, 0);
  const totalPnl = unrealized + realized;
  const balance = state.balance;
  const openCount = state.positions.length;

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closePanel]);

  if (!state.isPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 z-40 w-[380px] bg-sidebar border-l border-sidebar-border flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono font-bold text-sm tracking-widest text-amber-400">PAPER TRADE</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm("Reset all paper trades? This cannot be undone.")) reset(); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Reset paper account"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button onClick={closePanel} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Account Summary */}
        <div className="px-4 py-3 border-b border-sidebar-border flex-shrink-0">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-muted-foreground font-mono mb-0.5">BALANCE</div>
              <div className="font-mono font-bold text-xs">₹{fmt(balance)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-mono mb-0.5">UNREALIZED</div>
              <div className={cn("font-mono font-bold text-xs", unrealized >= 0 ? "text-success" : "text-destructive")}>
                {fmtPnl(unrealized)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground font-mono mb-0.5">TOTAL P&L</div>
              <div className={cn("font-mono font-bold text-xs", totalPnl >= 0 ? "text-success" : "text-destructive")}>
                {fmtPnl(totalPnl)}
              </div>
            </div>
          </div>
          {openCount > 0 && (
            <div className="mt-2 text-center">
              <span className="text-[10px] font-mono text-amber-400/70">{openCount} OPEN POSITION{openCount > 1 ? "S" : ""}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="new" className="flex flex-col flex-1 min-h-0">
          <TabsList className="flex-shrink-0 mx-4 mt-3 mb-0 bg-muted/30 rounded-sm h-8">
            <TabsTrigger value="new" className="flex-1 font-mono text-xs">NEW TRADE</TabsTrigger>
            <TabsTrigger value="positions" className="flex-1 font-mono text-xs">
              POSITIONS {openCount > 0 && <span className="ml-1 text-amber-400">({openCount})</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 font-mono text-xs">HISTORY</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <NewTradeForm prices={prices} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="positions" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <PositionsTab prices={prices} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <HistoryTab />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer disclaimer */}
        <Separator className="bg-sidebar-border flex-shrink-0" />
        <div className="px-4 py-2 text-[9px] text-muted-foreground/50 font-mono text-center flex-shrink-0">
          SIMULATED TRADES ONLY · NOT CONNECTED TO ANY BROKER
        </div>
      </div>
    </>
  );
}

// ── Toggle Button (used in sidebar) ──────────────────────────────────────────
export function PaperTradeToggle() {
  const { state, openPanel } = usePaperTrade();
  const { positions } = state;
  const hasPositions = positions.length > 0;

  return (
    <button
      onClick={openPanel}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-sm font-mono font-bold rounded-sm transition-colors",
        "border text-amber-400 border-amber-400/30 hover:bg-amber-400/10",
        hasPositions && "animate-pulse"
      )}
    >
      <ChevronRight className="h-4 w-4" />
      <span className="text-xs tracking-wider">PAPER TRADE</span>
      {hasPositions && (
        <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded-sm">
          {positions.length}
        </span>
      )}
    </button>
  );
}
