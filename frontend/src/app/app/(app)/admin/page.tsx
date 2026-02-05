"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/admin/users");
  }, [router]);

  return <div className="text-sm text-app-muted">Loading...</div>;
}
