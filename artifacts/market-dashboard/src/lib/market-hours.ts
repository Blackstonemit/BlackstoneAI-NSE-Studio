const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

export function toIST(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function getISTDate(): Date {
  return toIST(new Date());
}

export function isMarketOpen(): boolean {
  const ist = getISTDate();
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins < 930;
}

export function isPreOpenSession(): boolean {
  const ist = getISTDate();
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 540 && mins < 555;
}

export function getRefreshIntervalSecs(): number {
  return isMarketOpen() ? 15 : 60;
}

/** HH:MM:SS IST */
export function formatISTTime(date: Date): string {
  const ist = toIST(date);
  const h = ist.getUTCHours().toString().padStart(2, "0");
  const m = ist.getUTCMinutes().toString().padStart(2, "0");
  const s = ist.getUTCSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** HH:MM IST */
export function formatISTTimeHHMM(date: Date): string {
  const ist = toIST(date);
  const h = ist.getUTCHours().toString().padStart(2, "0");
  const m = ist.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** DD MMM YYYY IST (e.g. "07 Jun 2026") */
export function formatISTDate(date: Date): string {
  const ist = toIST(date);
  const d = ist.getUTCDate().toString().padStart(2, "0");
  const mon = MONTHS[ist.getUTCMonth()];
  const y = ist.getUTCFullYear();
  return `${d} ${mon} ${y}`;
}

/** DD MMM IST — no year (e.g. "07 Jun") */
export function formatISTShortDate(date: Date): string {
  const ist = toIST(date);
  const d = ist.getUTCDate().toString().padStart(2, "0");
  const mon = MONTHS[ist.getUTCMonth()];
  return `${d} ${mon}`;
}

/** DD MMM YYYY, HH:MM:SS IST */
export function formatISTDateTime(date: Date): string {
  return `${formatISTDate(date)}, ${formatISTTime(date)} IST`;
}

/** DD MMM YYYY, HH:MM IST */
export function formatISTDateTimeShort(date: Date): string {
  return `${formatISTDate(date)}, ${formatISTTimeHHMM(date)} IST`;
}
