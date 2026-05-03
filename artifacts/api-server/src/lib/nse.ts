import { logger } from "./logger.js";

const NSE_BASE = "https://www.nseindia.com";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "max-age=0",
};

const API_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  Referer: "https://www.nseindia.com/",
  "X-Requested-With": "XMLHttpRequest",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

class NSEClient {
  private cookies: string = "";
  private lastRefresh: number = 0;
  private readonly TTL = 4 * 60 * 1000; // 4 minutes

  private extractCookies(response: Response): string {
    // Node 20+ supports getSetCookie(); fall back to get() for Node 18
    let raw: string[] = [];
    if (typeof (response.headers as any).getSetCookie === "function") {
      raw = (response.headers as any).getSetCookie() as string[];
    } else {
      const combined = response.headers.get("set-cookie");
      if (combined) raw = combined.split(/,(?=[^ ])/);
    }
    return raw.map((c) => c.split(";")[0].trim()).join("; ");
  }

  private mergeCookies(existing: string, incoming: string): string {
    const map = new Map<string, string>();
    for (const part of existing.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k) map.set(k.trim(), v.join("=").trim());
    }
    for (const part of incoming.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k) map.set(k.trim(), v.join("=").trim());
    }
    return Array.from(map.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async refreshSession(): Promise<void> {
    try {
      // Step 1: hit homepage
      const home = await fetch(NSE_BASE, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });
      let cookies = this.extractCookies(home);

      // Step 2: hit option-chain page for additional session cookies
      const oc = await fetch(`${NSE_BASE}/option-chain`, {
        headers: { ...BROWSER_HEADERS, Cookie: cookies },
        redirect: "follow",
      });
      cookies = this.mergeCookies(cookies, this.extractCookies(oc));

      this.cookies = cookies;
      this.lastRefresh = Date.now();
      logger.info("NSE session refreshed");
    } catch (err) {
      logger.warn({ err }, "NSE session refresh failed");
      throw err;
    }
  }

  private async ensureSession(): Promise<void> {
    if (!this.cookies || Date.now() - this.lastRefresh > this.TTL) {
      await this.refreshSession();
    }
  }

  async get<T = any>(path: string): Promise<T> {
    await this.ensureSession();

    const url = `${NSE_BASE}/api${path}`;
    let response = await fetch(url, {
      headers: { ...API_HEADERS, Cookie: this.cookies },
    });

    // If session expired, refresh once and retry
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      logger.warn({ status: response.status, path }, "NSE session expired, refreshing");
      await this.refreshSession();
      response = await fetch(url, {
        headers: { ...API_HEADERS, Cookie: this.cookies },
      });
    }

    if (!response.ok) {
      throw new Error(`NSE API ${path} returned ${response.status}`);
    }

    // Update cookies from response
    const incoming = this.extractCookies(response);
    if (incoming) this.cookies = this.mergeCookies(this.cookies, incoming);

    return response.json() as Promise<T>;
  }
}

export const nseClient = new NSEClient();

// ─── NSE Response Types ──────────────────────────────────────────────────────

export interface NseOptionContract {
  strikePrice: number;
  expiryDate: string;
  openInterest: number;
  changeinOpenInterest: number;
  pchangeinOpenInterest: number;
  totalTradedVolume: number;
  impliedVolatility: number;
  lastPrice: number;
  change: number;
  pChange: number;
  bidQty: number;
  bidprice: number;
  askPrice: number;
  askQty: number;
  underlyingValue: number;
}

export interface NseOptionChainResponse {
  records: {
    underlyingValue: number;
    expiryDates: string[];
    data: Array<{
      strikePrice: number;
      expiryDate: string;
      CE?: NseOptionContract;
      PE?: NseOptionContract;
    }>;
  };
  filtered?: {
    data: Array<{
      strikePrice: number;
      expiryDate: string;
      CE?: NseOptionContract;
      PE?: NseOptionContract;
    }>;
  };
}

export interface NseIndex {
  indexSymbol: string;
  index: string;
  last: number;        // current price
  variation: number;   // price change
  percentChange: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  yearHigh: number;
  yearLow: number;
  perChange365d?: number;
  perChange30d?: number;
}

export interface NseAllIndicesResponse {
  data: NseIndex[];
  timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert NSE expiry string "05-May-2026" to ISO date */
export function nseExpiryToISO(expiry: string): string {
  try {
    return new Date(expiry).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** NSE index symbol map */
export const NSE_INDEX_SYMBOLS: Record<string, string> = {
  NIFTY: "NIFTY",
  BANKNIFTY: "BANKNIFTY",
  FINNIFTY: "FINNIFTY",
  MIDCPNIFTY: "MIDCPNIFTY",
};
