"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        const data = await apiFetch<InviteLookup>(
          `/invites/lookup?token=${encodeURIComponent(token)}`,
        );
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
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Accept invite</CardTitle>
            <p className="text-sm text-app-muted">
              Create your client account to start checking in.
            </p>
          </CardHeader>
          <CardContent>
            {invite && (
              <div className="mb-4 rounded-md border border-app-border bg-app-surface-2 p-3 text-sm">
                <div className="font-medium">Invited email</div>
                <div className="text-app-muted">{invite.email}</div>
                <div className="text-xs text-app-muted mt-1">
                  Status: {invite.status}
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-label text-app-muted">Full name</label>
                <Input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-label text-app-muted">Password</label>
                <Input
                  placeholder="Password (min 8 chars)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                className="w-full"
                type="submit"
                variant="primary"
                disabled={loading || !token}
              >
                {loading ? "Creating..." : "Create account"}
              </Button>

              {status && (
                <p className="text-sm text-app-danger whitespace-pre-wrap">
                  {status}
                </p>
              )}
            </form>

            <p className="mt-6 text-sm text-app-muted">
              Therapist?{" "}
              <Link href="/auth/login" className="text-app-text hover:underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
