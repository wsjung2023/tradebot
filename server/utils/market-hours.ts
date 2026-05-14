export function isKoreanMarketOpen(now: Date = new Date()): boolean {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);

  const kstDay = kstDate.getUTCDay();
  if (kstDay === 0 || kstDay === 6) return false;

  const kstMinutes = kstDate.getUTCHours() * 60 + kstDate.getUTCMinutes();
  return kstMinutes >= 9 * 60 && kstMinutes <= 15 * 60 + 30;
}
