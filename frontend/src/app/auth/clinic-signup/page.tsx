"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClinicSignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/signup?role=clinic");
  }, [router]);

  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-h2">Clinic admin signup</h1>
        <p className="mt-2 text-sm text-app-muted">
          Redirecting to the unified signup...
        </p>
      </div>
    </main>
  );
}
