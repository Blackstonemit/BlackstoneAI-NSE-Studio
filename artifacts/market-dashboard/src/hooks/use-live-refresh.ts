import { useEffect, useRef, useState, useCallback } from "react";
import {
  isMarketOpen,
  isPreOpenSession,
  getRefreshIntervalSecs,
  formatISTTime,
} from "@/lib/market-hours";
import { loadSettings } from "@/lib/settings";

export type UseLiveRefreshOptions = {
  onRefresh: () => void;
};

function getIntervalSecs(): number {
  const { autoRefresh, refreshInterval } = loadSettings();
  if (!autoRefresh) return Infinity;
  const settingsSecs = refreshInterval / 1000;
  const marketSecs = getRefreshIntervalSecs();
  return Math.min(settingsSecs, marketSecs === 15 ? 15 : settingsSecs);
}

export function useLiveRefresh({ onRefresh }: UseLiveRefreshOptions) {
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [preOpen, setPreOpen] = useState(isPreOpenSession());
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [paused, setPaused] = useState(() => !loadSettings().autoRefresh);

  const intervalSecs = useRef(getRefreshIntervalSecs());
  const [countdown, setCountdown] = useState(() => intervalSecs.current);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const remaining = useRef(intervalSecs.current);

  const doRefresh = useCallback(() => {
    onRefreshRef.current();
    setLastUpdated(new Date());
    const secs = getRefreshIntervalSecs();
    intervalSecs.current = secs;
    remaining.current = secs;
    setCountdown(secs);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const { autoRefresh, refreshInterval } = loadSettings();
      setPaused(!autoRefresh);

      const open = isMarketOpen();
      const pre = isPreOpenSession();
      setMarketOpen(open);
      setPreOpen(pre);

      if (!autoRefresh) return;

      const marketSecs = getRefreshIntervalSecs();
      const userSecs = refreshInterval / 1000;
      const effectiveSecs = open ? Math.min(userSecs, marketSecs) : userSecs;

      if (intervalSecs.current !== effectiveSecs) {
        intervalSecs.current = effectiveSecs;
        remaining.current = Math.min(remaining.current, effectiveSecs);
      }

      remaining.current -= 1;

      if (remaining.current <= 0) {
        onRefreshRef.current();
        setLastUpdated(new Date());
        remaining.current = intervalSecs.current;
      }

      setCountdown(Math.max(1, remaining.current));
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  return {
    isMarketOpen: marketOpen,
    isPreOpen: preOpen,
    lastUpdated,
    countdown,
    paused,
    lastUpdatedIST: formatISTTime(lastUpdated),
    refresh: doRefresh,
  };
}
