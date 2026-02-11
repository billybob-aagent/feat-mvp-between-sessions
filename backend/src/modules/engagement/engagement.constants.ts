const parseEnvNumber = (
  value: string | undefined,
  fallback: number,
  opts?: { min?: number; max?: number },
) => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (opts?.min !== undefined && parsed < opts.min) return fallback;
  if (opts?.max !== undefined && parsed > opts.max) return fallback;
  return parsed;
};

export const ENGAGEMENT_FIRST_NUDGE_HOURS = parseEnvNumber(
  process.env.ENGAGEMENT_FIRST_NUDGE_HOURS,
  24,
  { min: 1 },
);

export const ENGAGEMENT_PARTIAL_GRACE_HOURS = parseEnvNumber(
  process.env.ENGAGEMENT_PARTIAL_GRACE_HOURS,
  48,
  { min: 0 },
);

export const ENGAGEMENT_ESCALATION_OVERDUE_HOURS = parseEnvNumber(
  process.env.ENGAGEMENT_ESCALATION_OVERDUE_HOURS,
  72,
  { min: 0 },
);

export const ENGAGEMENT_PARTIAL_ESCALATION_COUNT = Math.max(
  1,
  Math.floor(
    parseEnvNumber(process.env.ENGAGEMENT_PARTIAL_ESCALATION_COUNT, 3, { min: 1 }),
  ),
);

export const ENGAGEMENT_HIGH_RISK_PARTIAL_COUNT = Math.max(
  1,
  Math.floor(
    parseEnvNumber(process.env.ENGAGEMENT_HIGH_RISK_PARTIAL_COUNT, 2, { min: 1 }),
  ),
);
