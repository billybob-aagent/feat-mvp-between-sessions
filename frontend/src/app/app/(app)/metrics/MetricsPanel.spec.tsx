import { render, screen } from "@testing-library/react";
import { MetricsPanel } from "./MetricsPanel";
import type { ReviewRevenueMetricsResponse } from "@/lib/types/metrics";

const baseMetrics: ReviewRevenueMetricsResponse = {
  ok: true,
  meta: {
    clinicId: "clinic-1",
    start: "2026-02-01",
    end: "2026-02-07",
    scope: "clinic",
    generatedAt: "2026-02-11T00:00:00.000Z",
  },
  summary: {
    reviewed_responses_count: 42,
    median_time_to_review_hours: 3.25,
    review_backlog_count: 5,
    assignment_completion_rate: 0.8,
    overdue_rate: 0.1,
    escalation_open_count: 2,
    escalation_median_time_to_resolve_hours: 12.5,
    aer_generated_count: 4,
    not_available: {
      reviewed_responses_count: false,
      median_time_to_review_hours: false,
      review_backlog_count: false,
      assignment_completion_rate: false,
      overdue_rate: false,
      escalation_open_count: false,
      escalation_median_time_to_resolve_hours: false,
      aer_generated_count: false,
    },
  },
};

describe("MetricsPanel", () => {
  it("renders KPI cards with mock payload", () => {
    render(
      <MetricsPanel
        metrics={baseMetrics}
        series={null}
        loading={false}
        error={null}
        roleLabel="Clinic"
        showEstimate
        minutesSavedPerReview={6}
      />,
    );

    expect(screen.getByText("Reviewed responses")).toBeInTheDocument();
    expect(screen.getByText("Review backlog")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
    expect(screen.getByText("Open escalations")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(
      <MetricsPanel
        metrics={null}
        series={null}
        loading={false}
        error={null}
        roleLabel="Clinic"
        showEstimate={false}
        minutesSavedPerReview={6}
      />,
    );

    expect(screen.getByText("No metrics loaded")).toBeInTheDocument();
  });

  it("does not crash on 500 errors", () => {
    render(
      <MetricsPanel
        metrics={null}
        series={null}
        loading={false}
        error="Server error"
        roleLabel="Clinic"
        showEstimate={false}
        minutesSavedPerReview={6}
      />,
    );

    expect(screen.getByText("Unable to load metrics")).toBeInTheDocument();
    expect(screen.getByText("Server error")).toBeInTheDocument();
  });
});
