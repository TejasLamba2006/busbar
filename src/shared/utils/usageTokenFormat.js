const EXACT_FORMATTER = new Intl.NumberFormat("en-US");
const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const UNITS = [
  { value: 1_000_000_000_000, suffix: "T" },
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
];

function tokenNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatExactTokens(value) {
  return EXACT_FORMATTER.format(tokenNumber(value));
}

export function formatCompactTokens(value) {
  const number = tokenNumber(value);
  const unit = UNITS.find(({ value: threshold }) => Math.abs(number) >= threshold);
  if (!unit) return formatExactTokens(number);
  return `${COMPACT_FORMATTER.format(number / unit.value)}${unit.suffix}`;
}
