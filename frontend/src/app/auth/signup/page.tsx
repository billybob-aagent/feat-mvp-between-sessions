"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await apiFetch("/auth/register-therapist", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      });
      setStatus("Account created. You're logged in.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Create your therapist account</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2 rounded" placeholder="Full name" value={fullName} onChange={(e)=>setFullName(e.target.value)} required />
        <input className="w-full border p-2 rounded" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <button className="w-full bg-black text-white py-2 rounded" type="submit">Create account</button>
        {status && <p className="text-sm text-gray-700">{status}</p>}
      </form>
      <p className="mt-4 text-sm">Already have an account? <Link href="/auth/login" className="underline">Log in</Link></p>
    </main>
  );
}