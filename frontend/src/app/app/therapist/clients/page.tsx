"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";

type Client = { id: string; full_name: string };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = (await apiFetch("/clients")) as Client[];
        setClients(data);
      } catch {}
    })();
  }, []);

  const filtered = q
    ? clients.filter((c) => c.full_name.toLowerCase().includes(q.toLowerCase()))
    : clients;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="max-w-xs" />
      </div>
      <ul className="divide-y border rounded-md">
        {filtered.map((c) => (
          <li key={c.id} className="p-4 flex items-center justify-between">
            <div className="font-medium">{c.full_name}</div>
            <Link className="text-sm underline" href={`/app/therapist/clients/${c.id}`}>Open</Link>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-6 text-sm text-muted-foreground">No clients found.</li>}
      </ul>
    </main>
  );
}
