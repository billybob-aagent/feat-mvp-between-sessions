"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Prompt = { id: string; title: string };
type Client = { id: string; full_name: string };

export default function AssignmentBuilderPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [promptId, setPromptId] = useState("");
  const [clientId, setClientId] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string| null>(null);

  useEffect(()=>{(async()=>{ try{ setPrompts(await apiFetch("/prompts")); setClients(await apiFetch("/clients")); }catch{}})();},[]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setStatus(null);
    await apiFetch("/assignments/create", { method: "POST", body: JSON.stringify({ promptId, clientId, due_date: due || null, note }) });
    setPromptId(""); setClientId(""); setDue(""); setNote("");
    setStatus("Assignment created");
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Assignment Builder</h1>
      <form onSubmit={create} className="grid md:grid-cols-3 gap-3">
        <select className="border rounded-md h-10 px-3" value={promptId} onChange={(e)=>setPromptId(e.target.value)} required>
          <option value="">Select prompt</option>
          {prompts.map((p:Prompt)=>(<option key={p.id} value={p.id}>{p.title}</option>))}
        </select>
        <select className="border rounded-md h-10 px-3" value={clientId} onChange={(e)=>setClientId(e.target.value)} required>
          <option value="">Select client</option>
          {clients.map((c:Client)=>(<option key={c.id} value={c.id}>{c.full_name}</option>))}
        </select>
        <Input type="date" value={due} onChange={(e)=>setDue(e.target.value)} />
        <Textarea className="md:col-span-3" placeholder="Optional note to accompany the assignment" value={note} onChange={(e)=>setNote(e.target.value)} />
        <div className="md:col-start-3"><Button className="w-full">Create assignment</Button></div>
        {status && <p className="text-sm text-muted-foreground md:col-span-3">{status}</p>}
      </form>
    </main>
  );
}
