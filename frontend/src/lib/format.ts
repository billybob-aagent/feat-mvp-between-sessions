export function formatIsoDate(value?: string | null) {
  if (!value) return "-";
  return value.split("T")[0];
}

export function formatIsoDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toISOString();
}

export function formatPercent(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatBytes(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
