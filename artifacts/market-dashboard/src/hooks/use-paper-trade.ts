import { createContext, useContext, useReducer, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Direction = "BUY" | "SELL";

export interface OpenPosition {
  id: string;
  symbol: string;
  direction: Direction;
  lots: number;
  lotSize: number;
  entryPrice: number;
  entryTime: number;
}

export interface ClosedTrade extends OpenPosition {
  exitPrice: number;
  exitTime: number;
  pnl: number;
}

export interface PaperTradeState {
  balance: number;
  positions: OpenPosition[];
  history: ClosedTrade[];
  isPanelOpen: boolean;
}

type Action =
  | { type: "OPEN_PANEL" }
  | { type: "CLOSE_PANEL" }
  | { type: "ADD_POSITION"; position: OpenPosition }
  | { type: "CLOSE_POSITION"; id: string; exitPrice: number }
  | { type: "RESET" };

// ── Lot sizes (NSE standard) ──────────────────────────────────────────────────
export const LOT_SIZES: Record<string, number> = {
  NIFTY: 75,
  BANKNIFTY: 35,
  FINNIFTY: 65,
  MIDCPNIFTY: 75,
  SENSEX: 20,
  BANKEX: 20,
  RELIANCE: 500,
  TCS: 175,
  HDFCBANK: 550,
  INFY: 400,
  ICICIBANK: 700,
  SBIN: 1500,
  TATAMOTORS: 1400,
  WIPRO: 1500,
  AXISBANK: 625,
};

export function getLotSize(symbol: string): number {
  return LOT_SIZES[symbol.toUpperCase()] ?? 1;
}

const STARTING_BALANCE = 1_000_000; // ₹10 lakh
const STORAGE_KEY = "paper_trade_v1";

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state: PaperTradeState, action: Action): PaperTradeState {
  switch (action.type) {
    case "OPEN_PANEL":
      return { ...state, isPanelOpen: true };
    case "CLOSE_PANEL":
      return { ...state, isPanelOpen: false };
    case "ADD_POSITION":
      return { ...state, positions: [...state.positions, action.position] };
    case "CLOSE_POSITION": {
      const pos = state.positions.find((p) => p.id === action.id);
      if (!pos) return state;
      const sign = pos.direction === "BUY" ? 1 : -1;
      const pnl = sign * (action.exitPrice - pos.entryPrice) * pos.lots * pos.lotSize;
      const closed: ClosedTrade = { ...pos, exitPrice: action.exitPrice, exitTime: Date.now(), pnl };
      return {
        ...state,
        balance: state.balance + pnl,
        positions: state.positions.filter((p) => p.id !== action.id),
        history: [closed, ...state.history].slice(0, 100),
      };
    }
    case "RESET":
      return { balance: STARTING_BALANCE, positions: [], history: [], isPanelOpen: state.isPanelOpen };
    default:
      return state;
  }
}

const defaultState: PaperTradeState = {
  balance: STARTING_BALANCE,
  positions: [],
  history: [],
  isPanelOpen: false,
};

// ── Context ───────────────────────────────────────────────────────────────────
import { createElement, type ReactNode } from "react";

interface PaperTradeContextValue {
  state: PaperTradeState;
  openPanel: () => void;
  closePanel: () => void;
  addPosition: (pos: Omit<OpenPosition, "id" | "entryTime">) => void;
  closePosition: (id: string, exitPrice: number) => void;
  reset: () => void;
  totalUnrealizedPnl: (prices: Record<string, number>) => number;
}

const PaperTradeContext = createContext<PaperTradeContextValue | null>(null);

export function PaperTradeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState, (init) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PaperTradeState>;
        return { ...init, ...parsed, isPanelOpen: false };
      }
    } catch { /* ignore */ }
    return init;
  });

  useEffect(() => {
    const { isPanelOpen: _, ...persisted } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [state]);

  const openPanel = useCallback(() => dispatch({ type: "OPEN_PANEL" }), []);
  const closePanel = useCallback(() => dispatch({ type: "CLOSE_PANEL" }), []);
  const addPosition = useCallback((pos: Omit<OpenPosition, "id" | "entryTime">) => {
    dispatch({ type: "ADD_POSITION", position: { ...pos, id: crypto.randomUUID(), entryTime: Date.now() } });
  }, []);
  const closePosition = useCallback((id: string, exitPrice: number) => {
    dispatch({ type: "CLOSE_POSITION", id, exitPrice });
  }, []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const totalUnrealizedPnl = useCallback((prices: Record<string, number>) => {
    return state.positions.reduce((sum, p) => {
      const ltp = prices[p.symbol] ?? p.entryPrice;
      const sign = p.direction === "BUY" ? 1 : -1;
      return sum + sign * (ltp - p.entryPrice) * p.lots * p.lotSize;
    }, 0);
  }, [state.positions]);

  return createElement(PaperTradeContext.Provider, {
    value: { state, openPanel, closePanel, addPosition, closePosition, reset, totalUnrealizedPnl },
    children,
  });
}

export function usePaperTrade() {
  const ctx = useContext(PaperTradeContext);
  if (!ctx) throw new Error("usePaperTrade must be used inside PaperTradeProvider");
  return ctx;
}
