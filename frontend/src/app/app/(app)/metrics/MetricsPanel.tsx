"use client";

import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/page/StatCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  ReviewRevenueMetricsResponse,
  ReviewRevenueMetricsSeriesResponse,
} from "@/lib/types/metrics";

type MetricsPanelProps = {
  metrics: ReviewRevenueMetricsResponse | null;
  series: ReviewRevenueMetricsSeriesResponse | null;
  loading: boolean;
  error: string | null;
  roleLabel: string;
  showEstimate: boolean;
  minutesSavedPerReview: number;
};

const formatNumber = (value: number) => value.toLocaleString();

const formatRate = (value: number | null, notAvailable?: boolean) => {
  if (notAvailable) return "N/A";
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
};

const formatHours = (value: number | null, notAvailable?: boolean) => {
  if (notAvailable) return "N/A";
  if (value === null) return "—";
  return `${value.toFixed(2)} hrs`;
};

const formatCount = (value: number, notAvailable?: boolean) => {
  if (notAvailable) return "N/A";
  return formatNumber(value);
};

export function MetricsPanel({
  metrics,
  series,
  loading,
  error,
  roleLabel,
  showEstimate,
  minutesSavedPerReview,
}: MetricsPanelProps) {
  const summary = metrics?.summary ?? null;
  const notAvailable = summary?.not_available ?? {};
  const ok = metrics?.ok ?? false;

  const reviewedCount = summary?.reviewed_responses_count ?? 0;
  const hoursSaved = showEstimate && !notAvailable.reviewed_responses_count
    ? (reviewedCount * minutesSavedPerReview) / 60
    : null;

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="danger" title="Unable to load metrics">
          {error}
        </Alert>
      )}

      {metrics && !ok && metrics.error?.message && (
        <Alert variant="danger" title="Metrics unavailable">
          {metrics.error.message}
        </Alert>
      )}

      {!metrics && !loading && !error && (
        <Alert variant="info" title="No metrics loaded">
          Select a clinic and date range, then click Load metrics.
        </Alert>
      )}

      {summary && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">
                Review to revenue
              </div>
              <h2 className="text-h3 mt-2">{roleLabel} operational impact</h2>
              <p className="text-sm text-app-muted mt-1">
                Aggregated metrics only. No client-level detail is exposed here.
              </p>
            </div>
            {showEstimate && (
              <div className="text-xs text-app-muted">
                Hours saved is an estimate (assumption shown below).
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Reviewed responses"
              value={formatCount(summary.reviewed_responses_count, notAvailable.reviewed_responses_count)}
            />
            <StatCard
              label="Review backlog"
              value={formatCount(summary.review_backlog_count, notAvailable.review_backlog_count)}
            />
            <StatCard
              label="Median review time"
              value={formatHours(summary.median_time_to_review_hours, notAvailable.median_time_to_review_hours)}
            />
            <StatCard
              label="Completion rate"
              value={formatRate(summary.assignment_completion_rate, notAvailable.assignment_completion_rate)}
            />
            <StatCard
              label="Overdue rate"
              value={formatRate(summary.overdue_rate, notAvailable.overdue_rate)}
            />
            <StatCard
              label="Open escalations"
              value={formatCount(summary.escalation_open_count, notAvailable.escalation_open_count)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Resolution & reporting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-app-muted">
                <div className="flex items-center justify-between">
                  <span>Escalation median time to resolve</span>
                  <span className="text-app-text font-medium">
                    {formatHours(
                      summary.escalation_median_time_to_resolve_hours,
                      notAvailable.escalation_median_time_to_resolve_hours,
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>AER generated</span>
                  <span className="text-app-text font-medium">
                    {formatCount(summary.aer_generated_count, notAvailable.aer_generated_count)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {showEstimate && (
              <Card>
                <CardHeader>
                  <CardTitle>Hours saved (estimate)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-app-muted">
                  <div className="text-2xl font-semibold text-app-text">
                    {hoursSaved === null ? "N/A" : `${hoursSaved.toFixed(1)} hrs`}
                  </div>
                  <div>
                    Assumes {minutesSavedPerReview} minutes saved per review. This is an estimate, not a guarantee.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {series && (
        <Card>
          <CardHeader>
            <CardTitle>Trends ({series.meta.bucket})</CardTitle>
          </CardHeader>
          <CardContent>
            {!series.ok && (
              <Alert variant="info" title="Trends unavailable">
                Metrics series could not be loaded for this range.
              </Alert>
            )}
            {series.ok && series.series.points.length === 0 && (
              <Alert variant="info" title="No trend data yet">
                No metrics captured for this range.
              </Alert>
            )}
            {series.ok && series.series.points.length > 0 && (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Date</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Backlog</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Open Escalations</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {series.series.points.map((point) => (
                    <TableRow key={point.bucket_start}>
                      <TableCell>{point.bucket_start}</TableCell>
                      <TableCell>{formatCount(point.reviewed_responses_count)}</TableCell>
                      <TableCell>{formatCount(point.review_backlog_count)}</TableCell>
                      <TableCell>{formatRate(point.assignment_completion_rate)}</TableCell>
                      <TableCell>{formatRate(point.overdue_rate)}</TableCell>
                      <TableCell>{formatCount(point.escalation_open_count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
