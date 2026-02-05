"use client";

import { useMe } from "@/lib/use-me";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import ClinicAssignmentsPage from "../clinic/assignments/page";
import TherapistAssignmentsPage from "../therapist/assignments/page";

export default function AssignmentsHubPage() {
  const { me, loading } = useMe();

  if (loading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (me?.role === "CLINIC_ADMIN") {
    return <ClinicAssignmentsPage />;
  }

  if (me?.role === "therapist") {
    return <TherapistAssignmentsPage />;
  }

  return <NotAuthorized message="Assignments are available to clinic administrators and therapists." />;
}
