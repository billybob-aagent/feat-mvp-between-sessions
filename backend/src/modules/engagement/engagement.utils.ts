import { ResponseCompletionStatus, SupervisorEscalationReason } from "@prisma/client";
import { formatDateOnly } from "../../reports/aer/aer-report.utils";
import {
  ENGAGEMENT_ESCALATION_OVERDUE_HOURS,
  ENGAGEMENT_FIRST_NUDGE_HOURS,
  ENGAGEMENT_HIGH_RISK_PARTIAL_COUNT,
  ENGAGEMENT_PARTIAL_ESCALATION_COUNT,
  ENGAGEMENT_PARTIAL_GRACE_HOURS,
} from "./engagement.constants";

export type EngagementState = "pending" | "partial" | "completed" | "overdue";

export type EngagementThresholds = {
  firstNudgeHours: number;
  partialGraceHours: number;
  escalationOverdueHours: number;
  partialEscalationCount: number;
  highRiskPartialCount: number;
};

export const DEFAULT_ENGAGEMENT_THRESHOLDS: EngagementThresholds = {
  firstNudgeHours: ENGAGEMENT_FIRST_NUDGE_HOURS,
  partialGraceHours: ENGAGEMENT_PARTIAL_GRACE_HOURS,
  escalationOverdueHours: ENGAGEMENT_ESCALATION_OVERDUE_HOURS,
  partialEscalationCount: ENGAGEMENT_PARTIAL_ESCALATION_COUNT,
  highRiskPartialCount: ENGAGEMENT_HIGH_RISK_PARTIAL_COUNT,
};

export type EngagementResponseInput = {
  createdAt: Date;
  completionStatus: ResponseCompletionStatus | null;
};

export type EngagementSummary = {
  state: EngagementState;
  stateChangedAt: Date | null;
  assignmentStartAt: Date;
  dueAt: Date | null;
  overdueAt: Date | null;
  completedCount: number;
  partialCount: number;
  totalResponses: number;
  firstCompletedAt: Date | null;
  firstPartialAt: Date | null;
  lastResponseAt: Date | null;
};

export type EngagementTransition = {
  from: EngagementState | null;
  to: EngagementState;
  effectiveAt: Date;
  reason: string;
};

export type EngagementEscalationDecision = {
  reason: SupervisorEscalationReason;
  trigger: "overdue" | "partial";
};

const HOUR_MS = 60 * 60 * 1000;

export const dateOnlyPartsFromTimeZone = (date: Date, timeZone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { year: get("year"), month: get("month"), day: get("day") };
  } catch {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    let year = get("year");
    let month = get("month");
    let day = get("day");
    let hour = get("hour");
    const minute = get("minute");
    const second = get("second");
    if (hour === 24) {
      hour = 0;
      const rollover = new Date(Date.UTC(year, month - 1, day));
      rollover.setUTCDate(rollover.getUTCDate() + 1);
      year = rollover.getUTCFullYear();
      month = rollover.getUTCMonth() + 1;
      day = rollover.getUTCDate();
    }
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second, date.getUTCMilliseconds());
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
};

const buildUtcDateFromZoneParts = (params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  timeZone: string;
}) => {
  const utcGuess = new Date(
    Date.UTC(
      params.year,
      params.month - 1,
      params.day,
      params.hour,
      params.minute,
      params.second,
      params.millisecond,
    ),
  );
  const offset = getTimeZoneOffsetMs(utcGuess, params.timeZone);
  return new Date(utcGuess.getTime() - offset);
};

export const normalizeDueDate = (
  dueDate: Date | null,
  timeZone: string | null | undefined,
) => {
  if (!dueDate) return null;
  if (!timeZone) return dueDate;
  const isUtcMidnight =
    dueDate.getUTCHours() === 0 &&
    dueDate.getUTCMinutes() === 0 &&
    dueDate.getUTCSeconds() === 0 &&
    dueDate.getUTCMilliseconds() === 0;
  if (!isUtcMidnight) return dueDate;
  const parts = dateOnlyPartsFromTimeZone(dueDate, timeZone);
  return buildUtcDateFromZoneParts({
    ...parts,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
    timeZone,
  });
};

export const formatDateOnlyInTimeZone = (date: Date, timeZone: string | null | undefined) => {
  if (!timeZone) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const parts = dateOnlyPartsFromTimeZone(date, timeZone);
  return formatDateOnly(parts);
};

const pickStartAt = (createdAt: Date, publishedAt: Date | null) =>
  publishedAt ?? createdAt;

const findMin = (values: Date[]) =>
  values.reduce<Date | null>((acc, value) => {
    if (!acc) return value;
    return value.getTime() <= acc.getTime() ? value : acc;
  }, null);

const findMax = (values: Date[]) =>
  values.reduce<Date | null>((acc, value) => {
    if (!acc) return value;
    return value.getTime() >= acc.getTime() ? value : acc;
  }, null);

export const summarizeEngagement = (params: {
  createdAt: Date;
  publishedAt: Date | null;
  dueDate: Date | null;
  responses: EngagementResponseInput[];
  clinicTimezone?: string | null;
  now?: Date;
  thresholds?: EngagementThresholds;
}): EngagementSummary => {
  const thresholds = params.thresholds ?? DEFAULT_ENGAGEMENT_THRESHOLDS;
  const now = params.now ?? new Date();
  const assignmentStartAt = pickStartAt(params.createdAt, params.publishedAt);

  const completedResponses = params.responses.filter(
    (response) => response.completionStatus !== ResponseCompletionStatus.PARTIAL,
  );
  const partialResponses = params.responses.filter(
    (response) => response.completionStatus === ResponseCompletionStatus.PARTIAL,
  );

  const firstCompletedAt = findMin(completedResponses.map((response) => response.createdAt));
  const firstPartialAt = findMin(partialResponses.map((response) => response.createdAt));
  const lastResponseAt = findMax(params.responses.map((response) => response.createdAt));

  const dueAt = normalizeDueDate(params.dueDate, params.clinicTimezone ?? null);
  const overdueAt = dueAt
    ? partialResponses.length > 0
      ? new Date(dueAt.getTime() + thresholds.partialGraceHours * HOUR_MS)
      : dueAt
    : null;

  let state: EngagementState = "pending";
  let stateChangedAt: Date | null = assignmentStartAt;

  if (completedResponses.length > 0 && firstCompletedAt) {
    state = "completed";
    stateChangedAt = firstCompletedAt;
  } else if (partialResponses.length > 0 && firstPartialAt) {
    if (overdueAt && now.getTime() >= overdueAt.getTime()) {
      state = "overdue";
      stateChangedAt = overdueAt;
    } else {
      state = "partial";
      stateChangedAt = firstPartialAt;
    }
  } else if (overdueAt && now.getTime() >= overdueAt.getTime()) {
    state = "overdue";
    stateChangedAt = overdueAt;
  }

  return {
    state,
    stateChangedAt,
    assignmentStartAt,
    dueAt,
    overdueAt,
    completedCount: completedResponses.length,
    partialCount: partialResponses.length,
    totalResponses: params.responses.length,
    firstCompletedAt,
    firstPartialAt,
    lastResponseAt,
  };
};

export const deriveEngagementTransitions = (params: {
  summary: EngagementSummary;
  now?: Date;
  thresholds?: EngagementThresholds;
}): EngagementTransition[] => {
  const now = params.now ?? new Date();
  const transitions: EngagementTransition[] = [];

  const firstPartialAt = params.summary.firstPartialAt;
  const firstCompletedAt = params.summary.firstCompletedAt;
  const overdueAt = params.summary.overdueAt;

  let currentState: EngagementState = "pending";

  if (
    firstPartialAt &&
    (!firstCompletedAt || firstPartialAt.getTime() <= firstCompletedAt.getTime())
  ) {
    if (firstPartialAt.getTime() <= now.getTime()) {
      transitions.push({
        from: "pending",
        to: "partial",
        effectiveAt: firstPartialAt,
        reason: "partial_response_submitted",
      });
      currentState = "partial";
    }
  }

  if (overdueAt && overdueAt.getTime() <= now.getTime()) {
    if (firstCompletedAt && firstCompletedAt.getTime() <= overdueAt.getTime()) {
      // completed before overdue, no overdue transition
    } else if (currentState === "partial") {
      transitions.push({
        from: "partial",
        to: "overdue",
        effectiveAt: overdueAt,
        reason: "partial_grace_elapsed",
      });
      currentState = "overdue";
    } else if (currentState === "pending") {
      transitions.push({
        from: "pending",
        to: "overdue",
        effectiveAt: overdueAt,
        reason: "due_date_passed",
      });
      currentState = "overdue";
    }
  }

  if (firstCompletedAt && firstCompletedAt.getTime() <= now.getTime()) {
    if (currentState === "pending") {
      transitions.push({
        from: "pending",
        to: "completed",
        effectiveAt: firstCompletedAt,
        reason: "completed_response_submitted",
      });
    } else if (currentState === "partial") {
      transitions.push({
        from: "partial",
        to: "completed",
        effectiveAt: firstCompletedAt,
        reason: "completed_response_submitted",
      });
    } else if (currentState === "overdue") {
      transitions.push({
        from: "overdue",
        to: "completed",
        effectiveAt: firstCompletedAt,
        reason: "completed_after_overdue",
      });
    }
  }

  return transitions;
};

export const shouldSendFirstNudge = (params: {
  summary: EngagementSummary;
  now?: Date;
  thresholds?: EngagementThresholds;
}) => {
  const thresholds = params.thresholds ?? DEFAULT_ENGAGEMENT_THRESHOLDS;
  const now = params.now ?? new Date();
  if (params.summary.totalResponses > 0) return false;
  if (params.summary.state !== "pending") return false;
  const nudgeAt = new Date(
    params.summary.assignmentStartAt.getTime() + thresholds.firstNudgeHours * HOUR_MS,
  );
  return now.getTime() >= nudgeAt.getTime();
};

export const isHighRiskEngagement = (params: {
  summary: EngagementSummary;
  thresholds?: EngagementThresholds;
}) => {
  const thresholds = params.thresholds ?? DEFAULT_ENGAGEMENT_THRESHOLDS;
  if (params.summary.state === "overdue") return true;
  if (params.summary.completedCount > 0) return false;
  return params.summary.partialCount >= thresholds.highRiskPartialCount;
};

export const getEscalationDecision = (params: {
  summary: EngagementSummary;
  now?: Date;
  thresholds?: EngagementThresholds;
}): EngagementEscalationDecision | null => {
  const thresholds = params.thresholds ?? DEFAULT_ENGAGEMENT_THRESHOLDS;
  const now = params.now ?? new Date();

  if (params.summary.completedCount > 0) return null;

  const overdueAt = params.summary.overdueAt;
  if (overdueAt) {
    const overdueThresholdAt = new Date(
      overdueAt.getTime() + thresholds.escalationOverdueHours * HOUR_MS,
    );
    if (now.getTime() >= overdueThresholdAt.getTime()) {
      if (params.summary.totalResponses === 0) {
        return { reason: SupervisorEscalationReason.NO_ACTIVITY, trigger: "overdue" };
      }
      if (params.summary.partialCount > 0) {
        return { reason: SupervisorEscalationReason.LOW_COMPLETION, trigger: "overdue" };
      }
      return { reason: SupervisorEscalationReason.MISSED_INTERVENTIONS, trigger: "overdue" };
    }
  }

  if (params.summary.partialCount >= thresholds.partialEscalationCount) {
    return { reason: SupervisorEscalationReason.LOW_COMPLETION, trigger: "partial" };
  }

  return null;
};

export const toEngagementKey = (transition: EngagementTransition) => {
  const ts = transition.effectiveAt.toISOString();
  return `${transition.to}:${ts}`;
};

export const buildEngagementAuditMetadata = (transition: EngagementTransition) => ({
  from_state: transition.from,
  to_state: transition.to,
  effective_at: transition.effectiveAt.toISOString(),
  reason: transition.reason,
  source: "system",
});
