"use client";

import { useEffect, useMemo } from "react";
import { useLocalStorageState } from "@/lib/use-local-storage";
import { useMe } from "@/lib/use-me";

type ClientSelectionKeyParams = {
  role?: string | null;
  userId?: string | null;
  clinicId?: string | null;
};

export function buildClientSelectionKey(params: ClientSelectionKeyParams) {
  const role = params.role ?? "unknown";
  const userId = params.userId ?? "anon";
  const clinicId = params.clinicId || "no-clinic";
  return `bs.client.selection.${role}.${userId}.${clinicId}`;
}

export function useSelectedClientId() {
  const { me } = useMe();
  const [clinicId] = useLocalStorageState("bs.clinic.id", "");
  const storageKey = useMemo(
    () =>
      buildClientSelectionKey({
        role: me?.role ?? null,
        userId: me?.userId ?? null,
        clinicId,
      }),
    [clinicId, me?.role, me?.userId],
  );
  const [storedClientId, setStoredClientId] = useLocalStorageState(storageKey, "");
  const queryClientId =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("clientId") ?? "";
  const clientId = queryClientId || storedClientId;

  useEffect(() => {
    if (!queryClientId) return;
    if (queryClientId === storedClientId) return;
    setStoredClientId(queryClientId);
  }, [queryClientId, setStoredClientId, storedClientId]);

  return {
    clientId,
    queryClientId,
    clinicId,
    storageKey,
    setStoredClientId,
  };
}
