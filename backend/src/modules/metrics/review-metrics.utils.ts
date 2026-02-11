import { BadRequestException } from "@nestjs/common";
import {
  buildDateRangeFromParts,
  dateOnlyPartsFromLocal,
  formatDateOnly,
  parseDateOnly,
} from "../../reports/aer/aer-report.utils";

export type MetricsDateRange = {
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
};

export type MetricsBucket = "day" | "week";

export type MetricsBucketRange = {
  start: Date;
  end: Date;
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const parseDateRangeOrThrow = (start: string, end: string): MetricsDateRange => {
  const startTrimmed = start?.trim();
  const endTrimmed = end?.trim();
  if (!startTrimmed || !endTrimmed) {
    throw new BadRequestException("start and end are required (YYYY-MM-DD)");
  }

  const startParts = parseDateOnly(startTrimmed);
  if (!startParts) {
    throw new BadRequestException("Invalid start date format (expected YYYY-MM-DD)");
  }

  const endParts = parseDateOnly(endTrimmed);
  if (!endParts) {
    throw new BadRequestException("Invalid end date format (expected YYYY-MM-DD)");
  }

  const startRange = buildDateRangeFromParts(startParts);
  const endRange = buildDateRangeFromParts(endParts);

  if (startRange.start > endRange.end) {
    throw new BadRequestException("start must be before end");
  }

  return {
    start: startRange.start,
    end: endRange.end,
    startLabel: formatDateOnly(startParts),
    endLabel: formatDateOnly(endParts),
  };
};

export const computeMedian = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const startOfDay = (date: Date) => {
  const out = new Date(date.getTime());
  out.setHours(0, 0, 0, 0);
  return out;
};

const endOfDay = (date: Date) => {
  const out = new Date(date.getTime());
  out.setHours(23, 59, 59, 999);
  return out;
};

export const buildBucketRanges = (
  range: MetricsDateRange,
  bucket: MetricsBucket,
): MetricsBucketRange[] => {
  const buckets: MetricsBucketRange[] = [];
  const stepDays = bucket === "week" ? 7 : 1;
  let cursor = startOfDay(range.start);

  while (cursor.getTime() <= range.end.getTime()) {
    const bucketStart = new Date(cursor.getTime());
    const bucketEnd = endOfDay(
      new Date(bucketStart.getTime() + (stepDays - 1) * DAY_MS),
    );
    const clampedEnd = bucketEnd.getTime() > range.end.getTime() ? range.end : bucketEnd;
    const label = formatDateOnly(dateOnlyPartsFromLocal(bucketStart));
    buckets.push({ start: bucketStart, end: clampedEnd, label });
    cursor = startOfDay(new Date(bucketStart.getTime() + stepDays * DAY_MS));
  }

  return buckets;
};
