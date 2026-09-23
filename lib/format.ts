/** Format a USD amount with sensible precision for both tiny and large values. */
export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  let digits = 2;
  if (abs > 0 && abs < 0.01) digits = 6;
  else if (abs < 1) digits = 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: abs >= 1000 ? 0 : 2,
    maximumFractionDigits: abs >= 1000 ? 0 : digits,
  }).format(n);
}

/** Format a per-1M-token price, e.g. "$0.075". */
export function formatRate(n: number | null): string {
  if (n === null) return "n/a";
  return `$${Number(n.toPrecision(6))}`;
}

/** Compact token counts, e.g. 1.2M. */
export function formatTokens(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
