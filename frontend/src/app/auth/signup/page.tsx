"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SignupRole = "therapist" | "client" | "clinic";

export default function SignupPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialRole = useMemo(() => {
    const roleParam = sp.get("role");
    if (roleParam === "clinic") return "clinic";
    if (roleParam === "client") return "client";
    return "therapist";
  }, [sp]);

  const [role, setRole] = useState<SignupRole>(initialRole);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (role === "therapist") {
        const cleanEmail = email.trim();
        const cleanName = fullName.trim();
        await apiFetch<{ ok: true }>("/auth/register/therapist", {
          method: "POST",
          body: JSON.stringify({
            email: cleanEmail,
            password,
            fullName: cleanName,
          }),
        });
        router.push("/app/therapist");
        return;
      }

      if (role === "client") {
        const cleanName = fullName.trim();
        const cleanToken = inviteToken.trim();
        await apiFetch<{ ok: true }>("/auth/register/client", {
          method: "POST",
          body: JSON.stringify({
            token: cleanToken,
            password,
            fullName: cleanName,
          }),
        });
        router.push("/app/client");
        return;
      }

      const cleanEmail = email.trim();
      const cleanClinicName = clinicName.trim();
      await apiFetch<{ ok: true }>("/auth/register/clinic", {
        method: "POST",
        body: JSON.stringify({
          email: cleanEmail,
          password,
          clinicName: cleanClinicName,
          timezone: timezone.trim() || "UTC",
        }),
      });
      router.push("/app/clinic/dashboard");
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
            <CardTitle>Create an account</CardTitle>
            <p className="text-sm text-app-muted">
              Choose your role and set up your access.
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
                <label className="text-label text-app-muted">Account type</label>
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value as SignupRole)}
                >
                  <option value="therapist">Therapist</option>
                  <option value="client">Client (invite required)</option>
                  <option value="clinic">Clinic admin</option>
                </Select>
              </div>

              {role !== "client" && (
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
              )}

              {role !== "clinic" && (
                <div>
                  <label className="text-label text-app-muted">Full name</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Kimo Alcala"
                    required
                    minLength={2}
                  />
                </div>
              )}

              {role === "client" && (
                <div>
                  <label className="text-label text-app-muted">Invite token</label>
                  <Input
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Paste your invite token"
                    required
                    minLength={10}
                    maxLength={200}
                  />
                </div>
              )}

              {role === "clinic" && (
                <>
                  <div>
                    <label className="text-label text-app-muted">Clinic name</label>
                    <Input
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="Between Sessions Clinic"
                      required
                      minLength={2}
                    />
                  </div>
                  <div>
                    <label className="text-label text-app-muted">Timezone</label>
                    <Input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="UTC"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-label text-app-muted">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full" variant="primary" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>

            <p className="text-sm text-app-muted mt-4">
              Already have an account?{" "}
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
