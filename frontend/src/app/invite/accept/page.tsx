"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function AcceptInviteInner() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await apiFetch("/clients/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password, fullName }),
      });
      setStatus("Invite accepted. You can now log in.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Accept invite</CardTitle>
            <p className="text-sm text-app-muted">
              Create your account to start checking in.
            </p>
          </CardHeader>
          <CardContent>
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
                  placeholder="Set password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button className="w-full" type="submit" variant="primary">
                Create account
              </Button>
              {status && (
                <p className="text-sm text-app-muted whitespace-pre-wrap">
                  {status}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-app-bg text-app-text">
          <div className="max-w-md mx-auto px-6 py-16 text-sm text-app-muted">
            Loading...
          </div>
        </main>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}
