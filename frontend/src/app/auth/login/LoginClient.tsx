"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setMeCache } from "@/lib/use-me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Me = { userId: string; role: string };

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sp.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim();

      await apiFetch<{ ok: true }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const me = await apiFetch<Me>("/auth/me", { method: "GET" });
      setMeCache(me);

      if (nextPath) {
        router.replace(nextPath);
        return;
      }

      if (me.role === "client") {
        router.replace("/app/client/assignments");
      } else {
        router.replace("/app/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <p className="text-sm text-app-muted">
              Secure access to your Between Sessions workspace.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 text-sm text-app-danger whitespace-pre-wrap">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-label text-app-muted">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div>
                <label className="text-label text-app-muted">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full" variant="primary" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-app-muted">
              New here?{" "}
              <Link href="/auth/signup" className="text-app-text hover:underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
