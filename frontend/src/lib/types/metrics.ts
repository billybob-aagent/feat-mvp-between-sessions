export type ReviewRevenueMetricsSummary = {
  reviewed_responses_count: number;
  median_time_to_review_hours: number | null;
  review_backlog_count: number;
  assignment_completion_rate: number | null;
  overdue_rate: number | null;
  escalation_open_count: number;
  escalation_median_time_to_resolve_hours: number | null;
  aer_generated_count: number;
  not_available: Record<string, boolean>;
};

export type ReviewRevenueMetricsResponse = {
  ok: boolean;
  meta: {
    clinicId: string;
    start: string;
    end: string;
    scope: "clinic" | "therapist";
    therapistId?: string | null;
    generatedAt: string;
  };
  summary: ReviewRevenueMetricsSummary;
  error?: { code: string; message: string };
};

export type ReviewRevenueMetricsSeriesPoint = {
  bucket_start: string;
  reviewed_responses_count: number;
  review_backlog_count: number;
  assignment_completion_rate: number | null;
  overdue_rate: number | null;
  escalation_open_count: number;
};

export type ReviewRevenueMetricsSeriesResponse = {
  ok: boolean;
  meta: {
    clinicId: string;
    start: string;
    end: string;
    bucket: "day" | "week";
    scope: "clinic";
    generatedAt: string;
  };
  series: {
    points: ReviewRevenueMetricsSeriesPoint[];
    not_available: Record<string, boolean>;
  };
  error?: { code: string; message: string };
};
