"use client";

import { useEffect, useMemo, useState } from "react";
import { useMe } from "@/lib/use-me";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { clinicDashboard } from "@/lib/clinic-api";
import {
  reviewMetricsClinic,
  reviewMetricsClinicSeries,
  reviewMetricsTherapist,
} from "@/lib/api";
import type {
  ReviewRevenueMetricsResponse,
  ReviewRevenueMetricsSeriesResponse,
} from "@/lib/types/metrics";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MetricsPanel } from "./MetricsPanel";

const DEFAULT_MINUTES_SAVED_PER_REVIEW = 6;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && value.constructor === Object) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = sortKeys(val);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortKeys(value), null, 2);
}

export default function MetricsPage() {
  const { me, loading: meLoading } = useMe();
  const role = me?.role ?? null;
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isAdmin = role === "admin";
  const isTherapist = role === "therapist";
  const canAccess = isClinicAdmin || isAdmin || isTherapist;

  const [clinicId, setClinicId] = useLocalStorageState("bs.metrics.clinicId", "");
  const [start, setStart] = useLocalStorageState("bs.metrics.start", daysAgoIso(14));
  const [end, setEnd] = useLocalStorageState("bs.metrics.end", todayIso());
  const [bucket, setBucket] = useLocalStorageState("bs.metrics.bucket", "week");

  const [metrics, setMetrics] = useState<ReviewRevenueMetricsResponse | null>(null);
  const [series, setSeries] = useState<ReviewRevenueMetricsSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isTherapist && me?.clinicId) {
      setClinicId(me.clinicId);
    }
  }, [isTherapist, me?.clinicId, setClinicId]);

  useEffect(() => {
    if (!isClinicAdmin) return;
    clinicDashboard()
      .then((res) => {
        if (!clinicId) setClinicId(res.clinic.id);
      })
      .catch(() => {
        // ignore
      });
  }, [isClinicAdmin, clinicId, setClinicId]);

  const canLoad = useMemo(() => {
    if (!canAccess) return false;
    if (!clinicId) return false;
    if (!start || !end) return false;
    return true;
  }, [canAccess, clinicId, start, end]);

  async function handleLoad() {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const response = isTherapist
        ? ((await reviewMetricsTherapist({ clinicId, start, end })) as ReviewRevenueMetricsResponse)
        : ((await reviewMetricsClinic({ clinicId, start, end })) as ReviewRevenueMetricsResponse);
      setMetrics(response);

      if (!isTherapist) {
        const seriesResponse = (await reviewMetricsClinicSeries({
          clinicId,
          start,
          end,
          bucket: bucket === "day" ? "day" : "week",
        })) as ReviewRevenueMetricsSeriesResponse;
        setSeries(seriesResponse);
      } else {
        setSeries(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMetrics(null);
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!metrics) return;
    const json = stableStringify(metrics);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ROI_METRICS_${metrics.meta.clinicId}_${metrics.meta.start}_${metrics.meta.end}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (meLoading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (!canAccess) {
    return (
      <NotAuthorized message="ROI metrics are available to therapists, clinic admins, and admins." />
    );
  }

  const roleLabel = isTherapist ? "My clients" : "Clinic";

  return (
    <PageLayout
      title="ROI Metrics"
      subtitle="Defensible operational metrics to prove review efficiency and throughput."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={handleLoad} disabled={!canLoad || loading}>
            {loading ? "Loading..." : "Load metrics"}
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={!metrics}>
            Export JSON
          </Button>
        </div>
      }
      filters={
        <FilterBar>
          <div className="min-w-[220px]">
            <label className="text-label text-app-muted">Clinic ID</label>
            <Input
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              placeholder="Clinic UUID"
              disabled={isClinicAdmin || isTherapist}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">Start</label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <label className="text-label text-app-muted">End</label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {!isTherapist && (
            <div className="min-w-[160px]">
              <label className="text-label text-app-muted">Bucket</label>
              <Select value={bucket} onChange={(e) => setBucket(e.target.value)}>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
              </Select>
            </div>
          )}
          {isAdmin && !clinicId && (
            <div className="flex items-end text-xs text-app-muted">Admin requires clinicId input.</div>
          )}
        </FilterBar>
      }
    >
      <MetricsPanel
        metrics={metrics}
        series={series}
        loading={loading}
        error={error}
        roleLabel={roleLabel}
        showEstimate={isClinicAdmin || isAdmin}
        minutesSavedPerReview={DEFAULT_MINUTES_SAVED_PER_REVIEW}
      />
    </PageLayout>
  );
}
