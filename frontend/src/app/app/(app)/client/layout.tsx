"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (!loading && me && me.role !== "client") {
      router.replace("/app");
    }
  }, [loading, me, router]);

  if (loading) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-h3">Loading...</h1>
        <p className="text-sm text-app-muted mt-2">Checking access.</p>
      </main>
    );
  }

  return <>{children}</>;
}
