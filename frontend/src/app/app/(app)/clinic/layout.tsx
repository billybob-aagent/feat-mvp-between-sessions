"use client";

import { ClinicSessionProvider } from "./clinic-session";
import { useMe } from "@/lib/use-me";

export default function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, loading } = useMe();
  return (
    <ClinicSessionProvider value={{ loading, role: me?.role ?? null }}>
      {children}
    </ClinicSessionProvider>
  );
}
