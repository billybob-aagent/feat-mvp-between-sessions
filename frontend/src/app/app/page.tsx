"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type MeResponse =
  | { authenticated: false }
  | { authenticated: true; userId: string; role: string };

export default function AppIndexPage() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      try {
        const me = await apiFetch<MeResponse>("/auth/me");

        if (!me || me.authenticated === false) {
          router.replace("/auth/login");
          return;
        }

        if (me.role === "therapist") {
          router.replace("/app/therapist/dashboard");
          return;
        }

        // default to client
        router.replace("/app/client/checkin");
      } catch {
        router.replace("/auth/login");
      }
    }

    go();
  }, [router]);

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold">Loading…</h1>
      <p className="text-gray-700 mt-2">Redirecting you into the app.</p>
    </main>
  );
}
