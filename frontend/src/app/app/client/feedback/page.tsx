"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Item = { id: string; created_at: string; text: string };

export default function ClientFeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(()=>{(async()=>{ try{ setItems(await apiFetch("/feedback/my")); }catch{}})();},[]);
  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold mb-4">Feedback</h1>
      <ul className="space-y-4">
        {items.map((f)=> (
          <li key={f.id} className="border rounded-md p-4">
            <div className="text-xs text-muted-foreground mb-2">{new Date(f.created_at).toLocaleString()}</div>
            <div className="text-sm leading-relaxed">{f.text}</div>
          </li>
        ))}
        {items.length===0 && <li className="text-sm text-muted-foreground">No feedback yet.</li>}
      </ul>
    </main>
  );
}
