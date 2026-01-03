"use client";
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type Prompt = { id: string; title: string; content: string };

export default function TherapistDashboard() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invite, setInvite] = useState<string | null>(null);

  async function load() {
    try {
      const data = (await apiFetch('/prompts')) as Prompt[];
      setPrompts(data);
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/prompts/create', { method: 'POST', body: JSON.stringify({ title, content }) });
    setTitle('');
    setContent('');
    await load();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    const res = (await apiFetch('/invites/create', { method: 'POST', body: JSON.stringify({ email: inviteEmail }) })) as {
      token: string;
      expires_at: string;
    };
    setInvite(`Invite for ${inviteEmail}: token ${res.token}`);
    setInviteEmail('');
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Therapist Dashboard</h1>

      <section className="grid md:grid-cols-2 gap-8">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Create Invite</h2>
          <form onSubmit={createInvite} className="space-y-2">
            <input className="w-full border p-2 rounded" placeholder="Client email" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} required />
            <button className="px-4 py-2 bg-black text-white rounded" type="submit">Create invite</button>
            {invite && <p className="text-xs text-gray-600 mt-2">{invite}</p>}
          </form>
        </div>
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Create Prompt</h2>
          <form onSubmit={createPrompt} className="space-y-2">
            <input className="w-full border p-2 rounded" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} required />
            <textarea className="w-full border p-2 rounded" placeholder="Content" value={content} onChange={(e)=>setContent(e.target.value)} required />
            <button className="px-4 py-2 bg-black text-white rounded" type="submit">Save prompt</button>
          </form>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold mb-2">Your Prompts</h2>
        <ul className="space-y-2">
          {prompts.map((p)=> (
            <li key={p.id} className="border rounded p-3"><div className="font-medium">{p.title}</div><div className="text-sm text-gray-700">{p.content}</div></li>
          ))}
        </ul>
      </section>
    </main>
  );
}