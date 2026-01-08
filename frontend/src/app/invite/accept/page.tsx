"use client";
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { apiFetch } from '@/lib/api';

function AcceptInviteInner() {
  const sp = useSearchParams();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await apiFetch('/clients/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password, fullName }),
      });
      setStatus('Invite accepted. You can now log in.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Accept invite</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="Full name" value={fullName} onChange={(e)=>setFullName(e.target.value)} required />
        <input className="w-full border p-2 rounded" placeholder="Set password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <button className="w-full bg-black text-white py-2 rounded" type="submit">Create account</button>
        {status && <p className="text-sm text-gray-700">{status}</p>}
      </form>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="max-w-md mx-auto px-6 py-16">Loading…</main>}>
      <AcceptInviteInner />
    </Suspense>
  );
}