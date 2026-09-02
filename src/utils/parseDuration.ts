const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Converts "15m", "1h", "30d" etc. into a future Date. Defaults to 15m if the format is invalid. */
export function durationFromNow(duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  const ms = match ? Number(match[1]) * UNIT_MS[match[2]] : 15 * UNIT_MS.m;
  return new Date(Date.now() + ms);
}
