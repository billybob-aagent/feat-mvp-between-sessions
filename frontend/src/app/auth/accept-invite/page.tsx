"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type InviteLookup = { email: string; status: string };

export default function AcceptInvitePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const token = useMemo(() => sp.get("token") ?? "", [sp]);

  const [invite, setInvite] = useState<InviteLookup | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus(null);
      try {
        if (!token) {
          setStatus("Missing invite token.");
          return;
        }
        const data = await apiFetch<InviteLookup>(`/invites/lookup?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        setInvite(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (cancelled) return;
        setStatus(msg);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setStatus(null);

    try {
      await apiFetch("/auth/register-client", {
        method: "POST",
        json: { token, fullName, password },
      });

      router.replace("/app/client/checkin");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-2">Accept invite</h1>
      <p className="text-gray-700 mb-6">
        Create your client account to start checking in.
      </p>

      {invite && (
        <div className="border rounded p-3 mb-4 text-sm">
          <div className="font-medium">Invited email</div>
          <div className="text-gray-700">{invite.email}</div>
          <div className="text-xs text-gray-500 mt-1">Status: {invite.status}</div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <input
          className="w-full border p-2 rounded"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <input
          className="w-full border p-2 rounded"
          placeholder="Password (min 8 chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          className="w-full bg-black text-white py-2 rounded disabled:opacity-60"
          type="submit"
          disabled={loading || !token}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        {status && <p className="text-sm text-red-600 whitespace-pre-wrap">{status}</p>}
      </form>

      <p className="mt-6 text-sm">
        Therapist? <Link href="/auth/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}
