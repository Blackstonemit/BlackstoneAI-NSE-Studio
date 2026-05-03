import { useEffect, useRef, useState, useCallback } from "react";
import {
  isMarketOpen,
  isPreOpenSession,
  getRefreshIntervalSecs,
  formatISTTime,
} from "@/lib/market-hours";

export type UseLiveRefreshOptions = {
  onRefresh: () => void;
};

export function useLiveRefresh({ onRefresh }: UseLiveRefreshOptions) {
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  const [preOpen, setPreOpen] = useState(isPreOpenSession());
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [countdown, setCountdown] = useState(() => getRefreshIntervalSecs());

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const remaining = useRef(getRefreshIntervalSecs());

  const doRefresh = useCallback(() => {
    onRefreshRef.current();
    setLastUpdated(new Date());
    remaining.current = getRefreshIntervalSecs();
    setCountdown(remaining.current);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      remaining.current -= 1;

      const open = isMarketOpen();
      const pre = isPreOpenSession();
      setMarketOpen(open);
      setPreOpen(pre);

      if (remaining.current <= 0) {
        onRefreshRef.current();
        setLastUpdated(new Date());
        remaining.current = getRefreshIntervalSecs();
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
    lastUpdatedIST: formatISTTime(lastUpdated),
    refresh: doRefresh,
  };
}
