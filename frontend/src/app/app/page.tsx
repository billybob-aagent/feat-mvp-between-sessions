"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";

export default function AppIndexPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading || !me) return;

    if (me.role === "therapist") {
      router.replace("/app/therapist");
      return;
    }

    if (me.role === "client") {
      router.replace("/app/client");
      return;
    }

    if (me.role === "admin") {
      router.replace("/app/admin/users");
      return;
    }

    if (me.role === "CLINIC_ADMIN") {
      router.replace("/app/clinic/dashboard");
      return;
    }
  }, [loading, me, router]);

  return (
    <div className="text-sm text-app-muted">
      {loading ? "Loading..." : "Ready."}
    </div>
  );
}
