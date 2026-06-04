const KRX_CLOSED_DATES = new Set([
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-03-02",
  "2026-05-01",
  "2026-05-05",
  "2026-05-25",
  "2026-06-03",
  "2026-07-17",
  "2026-08-17",
  "2026-09-24",
  "2026-09-25",
  "2026-10-05",
  "2026-10-09",
  "2026-12-25",
  "2026-12-31",
]);

function toKstDateParts(now: Date): { dateKey: string; day: number; minutes: number } {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, "0");
  const date = String(kstDate.getUTCDate()).padStart(2, "0");

  return {
    dateKey: `${year}-${month}-${date}`,
    day: kstDate.getUTCDay(),
    minutes: kstDate.getUTCHours() * 60 + kstDate.getUTCMinutes(),
  };
}

export function isKrxMarketHoliday(now: Date = new Date()): boolean {
  const { dateKey, day } = toKstDateParts(now);
  return day === 0 || day === 6 || KRX_CLOSED_DATES.has(dateKey);
}

export function isKoreanMarketOpen(now: Date = new Date()): boolean {
  if (isKrxMarketHoliday(now)) return false;

  const { minutes } = toKstDateParts(now);
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}
