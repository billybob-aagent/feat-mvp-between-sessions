"use client";

import Link from "next/link";
import { useMe } from "@/lib/use-me";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import { Card, CardContent } from "@/components/ui/card";
import ClinicResponsesPage from "../clinic/responses/page";

export default function ResponsesHubPage() {
  const { me, loading } = useMe();

  if (loading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (me?.role === "CLINIC_ADMIN") {
    return <ClinicResponsesPage />;
  }

  if (me?.role === "therapist") {
    return (
      <Card>
        <CardContent className="space-y-3 text-sm text-app-muted">
          <div className="font-medium text-app-text">Responses live on assignments</div>
          <p>
            Open an assignment to review client responses and draft feedback.
          </p>
          <Link
            href="/app/therapist/assignments"
            className="inline-flex items-center justify-center rounded-md border border-app-border px-3 py-1.5 text-xs text-app-text hover:bg-app-surface-2"
          >
            Go to assignments
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <NotAuthorized message="Responses are available to clinic administrators and therapists." />;
}
