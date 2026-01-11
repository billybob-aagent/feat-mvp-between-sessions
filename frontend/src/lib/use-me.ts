import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type Me = { userId: string; role: "therapist" | "client" | "CLINIC_ADMIN" | "admin" | string };

type CacheState = {
  value: Me | null | undefined;
  inflight: Promise<Me | null> | null;
  listeners: Set<() => void>;
};

const cache: CacheState = {
  value: undefined,
  inflight: null,
  listeners: new Set(),
};

function notify() {
  cache.listeners.forEach((fn) => fn());
}

export function setMeCache(value: Me | null) {
  cache.value = value;
  cache.inflight = null;
  notify();
}

export function invalidateMeCache() {
  cache.value = undefined;
  cache.inflight = null;
  notify();
}

async function fetchMe(): Promise<Me | null> {
  try {
    return await apiFetch<Me>("/auth/me", { method: "GET", skipAuthRedirect: true });
  } catch {
    return null;
  }
}

function ensureMe(): Promise<Me | null> {
  if (cache.value !== undefined) return Promise.resolve(cache.value);
  if (!cache.inflight) {
    cache.inflight = fetchMe().then((me) => {
      cache.value = me;
      cache.inflight = null;
      notify();
      return me;
    });
  }
  return cache.inflight;
}

function subscribe(listener: () => void) {
  cache.listeners.add(listener);
  return () => cache.listeners.delete(listener);
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(() => cache.value ?? null);
  const [loading, setLoading] = useState(cache.value === undefined);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribe(() => {
      if (!active) return;
      setMe(cache.value ?? null);
      setLoading(cache.value === undefined);
    });

    if (cache.value === undefined) {
      ensureMe().catch(() => {});
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { me, loading };
}
