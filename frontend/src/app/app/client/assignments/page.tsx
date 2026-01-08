"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Assignment = { id: string; due_date: string | null };

export default function ClientAssignmentsPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    try {
      const data = (await apiFetch('/assignments/mine')) as Assignment[];
      setItems(data);
    } catch {
      // ignore
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setStatus(null);
    try {
      await apiFetch('/responses/submit', { method: 'POST', body: JSON.stringify({ assignmentId: selected, text }) });
      setText('');
      setStatus('Submitted');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-4">My Assignments</h1>
      <ul className="space-y-2">
        {items.map((a)=> (
          <li key={a.id} className={`border rounded p-3 ${selected===a.id ? 'border-black' : ''}`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Assignment</div>
                <div className="text-xs text-gray-600">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</div>
              </div>
              <button className="px-3 py-1 border rounded" onClick={()=>setSelected(a.id)}>Respond</button>
            </div>
          </li>
        ))}
      </ul>

      {selected && (
        <form onSubmit={submit} className="mt-6 space-y-3">
          <textarea className="w-full border p-2 rounded" placeholder="Your reflection" value={text} onChange={(e)=>setText(e.target.value)} required />
          <button className="px-4 py-2 bg-black text-white rounded" type="submit">Submit</button>
          {status && <p className="text-sm text-gray-700">{status}</p>}
        </form>
      )}
    </main>
  );
}