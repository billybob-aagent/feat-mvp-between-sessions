"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Response = { id: string; client_id: string; created_at: string; preview: string };

export default function FeedbackEditorPage() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(()=>{(async()=>{ try{ setResponses(await apiFetch("/responses/pending-feedback")); }catch{}})();},[]);

  async function send(e: React.FormEvent) {
    e.preventDefault(); if(!selected) return; setStatus(null);
    await apiFetch("/feedback/send", { method: "POST", body: JSON.stringify({ responseId: selected, text }) });
    setText(""); setSelected(null); setStatus("Feedback sent");
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Feedback</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <aside className="md:col-span-1 border rounded-md divide-y">
          {responses.map((r)=> (
            <button key={r.id} className={`text-left w-full p-3 text-sm ${selected===r.id? 'bg-accent' : ''}`} onClick={()=>setSelected(r.id)}>
              <div className="font-medium">Response · {new Date(r.created_at).toLocaleDateString()}</div>
              <div className="text-muted-foreground line-clamp-2">{r.preview}</div>
            </button>
          ))}
          {responses.length===0 && <div className="p-4 text-sm text-muted-foreground">No responses awaiting feedback.</div>}
        </aside>
        <section className="md:col-span-2">
          <form onSubmit={send} className="space-y-3">
            <Textarea placeholder="Write a short, supportive note" value={text} onChange={(e)=>setText(e.target.value)} disabled={!selected} required />
            <Button disabled={!selected}>Send feedback</Button>
            {status && <div className="text-sm text-muted-foreground">{status}</div>}
          </form>
        </section>
      </div>
    </main>
  );
}
