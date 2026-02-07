"use client";

import { useEffect, useMemo, useState } from "react";
import { useMe } from "@/lib/use-me";
import { apiDownloadPost, apiFetch } from "@/lib/api";
import { clinicDashboard, clinicListClients } from "@/lib/clinic-api";
import type { ClinicClientListItem } from "@/lib/types/clinic";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { PageLayout } from "@/components/page/PageLayout";
import { FilterBar } from "@/components/page/FilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RequireRole } from "@/components/auth/RequireRole";
import { SUBMISSION_PROFILES, FORBIDDEN_LANGUAGE, getSubmissionProfile } from "@/lib/submission-profiles";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

type AerReport = {
  meta?: { period?: { start?: string; end?: string } };
  context?: { client?: { display_id?: string | null } };
  prescribed_interventions?: Array<{ status_summary?: { completed?: number; missed?: number }; reviewed_at?: string | null }>;
};

type EscalationList = {
  rows?: Array<{ status?: string; sla?: { overdue?: boolean } }>;
};

export default function SubmissionBundlePage() {
  const { me } = useMe();
  const role = me?.role ?? null;
  const isAdmin = role === "admin";
  const isClinicAdmin = role === "CLINIC_ADMIN";
  const isTherapist = role === "therapist";
  const canAdmin = isAdmin || isClinicAdmin;

  const [clinicId, setClinicId] = useLocalStorageState("bs.submission.clinicId", "");
  const [clientId, setClientId] = useLocalStorageState("bs.submission.clientId", "");
  const [profileKey, setProfileKey] = useLocalStorageState("bs.submission.profile", "GENERIC");

  const profile = getSubmissionProfile(profileKey);

  const [start, setStart] = useLocalStorageState(
    "bs.submission.start",
    daysAgoIso(profile.recommendedPeriodDays),
  );
  const [end, setEnd] = useLocalStorageState("bs.submission.end", todayIso());
  const [autoPeriod, setAutoPeriod] = useState(true);

  const [includeWeeklyPacket, setIncludeWeeklyPacket] = useState(
    profile.key === "IOP" || profile.key === "PHP",
  );
  const [includeEscalations, setIncludeEscalations] = useState(false);
  const [escalationsTouched, setEscalationsTouched] = useState(false);
  const [includeExternalLinks, setIncludeExternalLinks] = useState(false);
  const [externalTtlMinutes, setExternalTtlMinutes] = useState(60);

  const [clients, setClients] = useState<ClinicClientListItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    displayId: string;
    assigned: number;
    completed: number;
    missed: number;
    reviewed: number;
    openEscalations: number;
    overdueEscalations: number;
  } | null>(null);

  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [languageExpanded, setLanguageExpanded] = useState(false);

  useEffect(() => {
    if (!autoPeriod) return;
    setStart(daysAgoIso(profile.recommendedPeriodDays));
    setEnd(todayIso());
  }, [profile.recommendedPeriodDays, autoPeriod, setStart, setEnd]);

  useEffect(() => {
    setIncludeWeeklyPacket(profile.key === "IOP" || profile.key === "PHP");
  }, [profile.key]);

  useEffect(() => {
    if (!canAdmin || clinicId) return;
    clinicDashboard()
      .then((data) => {
        if (data?.clinic?.id) setClinicId(data.clinic.id);
      })
      .catch(() => undefined);
  }, [canAdmin, clinicId, setClinicId]);

  useEffect(() => {
    if (!canAdmin && !isTherapist) return;
    if (isAdmin && !clinicId) return;

    setLoadingClients(true);
    setClients([]);
    clinicListClients({ limit: 100, clinicId: isAdmin ? clinicId : undefined })
      .then((data) => setClients(Array.isArray(data.items) ? data.items : []))
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false));
  }, [canAdmin, isTherapist, isAdmin, clinicId]);

  const bundleFiles = useMemo(() => {
    const files = [
      "AER.json",
      "AER.pdf",
      "verification.txt",
      "submission_summary.txt",
      "acceptance_language.md",
      "FORBIDDEN_LANGUAGE.md",
    ];
    if (includeWeeklyPacket) files.push("weekly_packet.json");
    if (includeEscalations) files.push("escalations.json");
    if (includeExternalLinks) files.push("external_links.txt");
    return files;
  }, [includeWeeklyPacket, includeEscalations, includeExternalLinks]);

  const sortedBundleFiles = useMemo(() => [...bundleFiles].sort(), [bundleFiles]);

  async function loadSummary() {
    if (!clinicId || !clientId) {
      setSummaryError("Clinic and client are required.");
      return;
    }
    if (!canAdmin) {
      setSummaryError("Summary preview is available to clinic admins and admins.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const qs = new URLSearchParams({ start, end }).toString();
      const report = await apiFetch<AerReport>(
        `/reports/aer/${encodeURIComponent(clinicId)}/${encodeURIComponent(clientId)}?${qs}`,
      );
      const interventions = report.prescribed_interventions ?? [];
      const assigned = interventions.length;
      const completed = interventions.reduce(
        (sum, entry) => sum + (entry.status_summary?.completed ?? 0),
        0,
      );
      const missed = interventions.reduce(
        (sum, entry) => sum + (entry.status_summary?.missed ?? 0),
        0,
      );
      const reviewed = interventions.filter((entry) => entry.reviewed_at).length;

      let openEscalations = 0;
      let overdueEscalations = 0;

      if (includeEscalations || (!escalationsTouched && canAdmin)) {
        const escalation = await apiFetch<EscalationList>(
          `/supervisor-actions/escalations/${encodeURIComponent(clinicId)}?status=OPEN&start=${start}&end=${end}&limit=200`,
        );
        const rows = escalation.rows ?? [];
        openEscalations = rows.length;
        overdueEscalations = rows.filter((row) => row.sla?.overdue).length;
        if (!escalationsTouched && rows.length > 0) {
          setIncludeEscalations(true);
        }
      }

      setSummary({
        displayId: report.context?.client?.display_id ?? clientId,
        assigned,
        completed,
        missed,
        reviewed,
        openEscalations,
        overdueEscalations,
      });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function downloadBundle() {
    if (!clinicId || !clientId) {
      setDownloadStatus("Clinic and client are required.");
      return;
    }
    setDownloadStatus(null);
    try {
      const body: Record<string, unknown> = {
        clinicId,
        clientId,
        start,
        end,
        profile: profile.key,
        includeWeeklyPacket,
        includeExternalLinks,
        externalTtlMinutes,
      };
      if (escalationsTouched) body.includeEscalations = includeEscalations;
      const { blob, filename } = await apiDownloadPost("/reports/submission-bundle", body);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `SUBMISSION_BUNDLE_${clientId}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloadStatus("Bundle downloaded.");
    } catch (err) {
      setDownloadStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <RequireRole roles={["therapist", "CLINIC_ADMIN", "admin"]}>
      <PageLayout
        title="Submission Bundle (UR)"
        subtitle="Package AER and related artifacts with payer-safe language."
      >
        <FilterBar
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={loadSummary} disabled={summaryLoading}>
                {summaryLoading ? "Loading..." : "Preview Summary"}
              </Button>
              <Button variant="primary" onClick={downloadBundle}>
                Download Submission Bundle (.zip)
              </Button>
            </div>
          }
        >
          {isAdmin && (
            <div className="min-w-[220px]">
              <label className="block text-label text-app-muted mb-1">Clinic ID</label>
              <Input value={clinicId} onChange={(e) => setClinicId(e.target.value)} />
            </div>
          )}
          <div className="min-w-[220px]">
            <label className="block text-label text-app-muted mb-1">Client</label>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={loadingClients || (isAdmin && !clinicId)}
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.fullName || client.email || client.id}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-label text-app-muted mb-1">Start</label>
            <Input
              type="date"
              value={start}
              onChange={(e) => {
                setAutoPeriod(false);
                setStart(e.target.value);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-label text-app-muted mb-1">End</label>
            <Input
              type="date"
              value={end}
              onChange={(e) => {
                setAutoPeriod(false);
                setEnd(e.target.value);
              }}
            />
          </div>
          <div className="min-w-[200px]">
            <label className="block text-label text-app-muted mb-1">UR Profile</label>
            <Select value={profile.key} onChange={(e) => setProfileKey(e.target.value)}>
              {Object.values(SUBMISSION_PROFILES).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.displayName}
                </option>
              ))}
            </Select>
          </div>
        </FilterBar>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-xs text-app-muted">
                Recommended period: {profile.recommendedPeriodDays} days.
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeWeeklyPacket}
                  onChange={(e) => setIncludeWeeklyPacket(e.target.checked)}
                  disabled={!canAdmin}
                />
                <span>Include weekly packet (JSON)</span>
              </label>
              {!canAdmin && (
                <div className="text-xs text-app-muted">
                  Weekly packet requires clinic admin or admin.
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeEscalations}
                  onChange={(e) => {
                    setIncludeEscalations(e.target.checked);
                    setEscalationsTouched(true);
                  }}
                  disabled={!canAdmin}
                />
                <span>Include escalations (JSON)</span>
              </label>
              {!canAdmin && (
                <div className="text-xs text-app-muted">
                  Escalations require clinic admin or admin.
                </div>
              )}
              {canAdmin && !escalationsTouched && (
                <div className="text-xs text-app-muted">
                  Default behavior: include if any escalations overlap the period.
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeExternalLinks}
                  onChange={(e) => setIncludeExternalLinks(e.target.checked)}
                  disabled={!canAdmin}
                />
                <span>Include external links</span>
              </label>
              {includeExternalLinks && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-app-muted">TTL minutes</label>
                  <Input
                    type="number"
                    min={1}
                    max={10080}
                    value={externalTtlMinutes}
                    onChange={(e) => setExternalTtlMinutes(Number(e.target.value))}
                    className="w-28"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bundle Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sortedBundleFiles.map((file) => (
                <div key={file}>• {file}</div>
              ))}
              {downloadStatus && <div className="text-xs text-app-muted">{downloadStatus}</div>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Acceptance Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <pre className="whitespace-pre-wrap text-app-muted">
              {profile.acceptanceLanguage}
            </pre>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(profile.acceptanceLanguage);
              }}
            >
              Copy Acceptance Language
            </Button>
            <div className="text-xs text-app-muted">{profile.disclaimer}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Forbidden Language
              <Button
                variant="ghost"
                className="ml-2"
                onClick={() => setLanguageExpanded((prev) => !prev)}
              >
                {languageExpanded ? "Hide" : "Show"}
              </Button>
            </CardTitle>
          </CardHeader>
          {languageExpanded && (
            <CardContent className="space-y-2 text-sm">
              {FORBIDDEN_LANGUAGE.map((line) => (
                <div key={line}>• {line}</div>
              ))}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UR Intake Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summaryError && <div className="text-red-600">{summaryError}</div>}
            {!summary && !summaryError && (
              <div className="text-xs text-app-muted">Load summary to preview counts.</div>
            )}
            {summary && (
              <div className="space-y-2">
                <div>Client: {summary.displayId}</div>
                <div>Period: {start} → {end}</div>
                <div>Assigned: {summary.assigned}</div>
                <div>Completed: {summary.completed}</div>
                <div>Missed: {summary.missed}</div>
                <div>Reviewed evidence: {summary.reviewed}</div>
                {includeEscalations && (
                  <div>
                    Open escalations: {summary.openEscalations} (Overdue: {summary.overdueEscalations})
                  </div>
                )}
                <div className="text-xs text-app-muted">
                  Bundle includes {bundleFiles.length} files for profile {profile.displayName}.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </RequireRole>
  );
}
