import { buildBucketRanges, computeMedian, parseDateRangeOrThrow } from "./review-metrics.utils";

describe("review-metrics.utils", () => {
  it("parses date-only range inclusively", () => {
    const range = parseDateRangeOrThrow("2026-02-01", "2026-02-01");
    expect(range.start.getHours()).toBe(0);
    expect(range.start.getMinutes()).toBe(0);
    expect(range.start.getSeconds()).toBe(0);
    expect(range.start.getMilliseconds()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
    expect(range.end.getSeconds()).toBe(59);
    expect(range.end.getMilliseconds()).toBe(999);
  });

  it("computes median for odd and even sets", () => {
    expect(computeMedian([3, 1, 2])).toBe(2);
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    expect(computeMedian([])).toBeNull();
  });

  it("builds bucket ranges in deterministic order", () => {
    const range = parseDateRangeOrThrow("2026-02-01", "2026-02-03");
    const buckets = buildBucketRanges(range, "day");
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ]);
  });
});
