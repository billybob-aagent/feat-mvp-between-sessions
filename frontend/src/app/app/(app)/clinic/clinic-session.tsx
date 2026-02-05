"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type ClinicSession = {
  loading: boolean;
  role: string | null;
};

const ClinicSessionContext = createContext<ClinicSession>({
  loading: true,
  role: null,
});

export function ClinicSessionProvider({
  value,
  children,
}: {
  value: ClinicSession;
  children: ReactNode;
}) {
  return (
    <ClinicSessionContext.Provider value={value}>
      {children}
    </ClinicSessionContext.Provider>
  );
}

export function useClinicSession() {
  return useContext(ClinicSessionContext);
}
