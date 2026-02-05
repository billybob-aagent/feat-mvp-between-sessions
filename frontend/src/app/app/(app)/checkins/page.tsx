"use client";

import { useMe } from "@/lib/use-me";
import { NotAuthorized } from "@/components/page/NotAuthorized";
import ClinicCheckinsPage from "../clinic/checkins/page";

export default function CheckinsHubPage() {
  const { me, loading } = useMe();

  if (loading) {
    return <div className="text-sm text-app-muted">Loading...</div>;
  }

  if (me?.role === "CLINIC_ADMIN") {
    return <ClinicCheckinsPage />;
  }

  return (
    <NotAuthorized message="Check-in oversight is available to clinic administrators." />
  );
}
