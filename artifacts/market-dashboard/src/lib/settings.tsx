import { useState, useCallback } from "react";

export type Settings = {
  defaultSymbol: string;
  defaultExchange: "NSE" | "BSE";
  refreshInterval: number;
  autoRefresh: boolean;
  lotSize: number;
  riskFreeRate: number;
  defaultIV: number;
  signalSymbols: string;
  defaultTimeframe: "INTRADAY" | "SWING" | "POSITIONAL";
  showSyntheticData: boolean;
  highlightATM: boolean;
};

const SETTINGS_KEY = "nse_terminal_settings";

export const DEFAULT_SETTINGS: Settings = {
  defaultSymbol: "NIFTY",
  defaultExchange: "NSE",
  refreshInterval: 30000,
  autoRefresh: true,
  lotSize: 75,
  riskFreeRate: 6.5,
  defaultIV: 15,
  signalSymbols: "NIFTY,BANKNIFTY,RELIANCE,TCS,HDFCBANK",
  defaultTimeframe: "INTRADAY",
  showSyntheticData: true,
  highlightATM: true,
};

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return { settings, update, reset };
}
