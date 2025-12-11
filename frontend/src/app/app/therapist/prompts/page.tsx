"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Prompt = { id: string; title: string; content: string };

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function load() {
    try { setPrompts((await apiFetch("/prompts")) as Prompt[]); } catch {}
  }
  useEffect(()=>{ load(); },[]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/prompts/create", { method: "POST", body: JSON.stringify({ title, content }) });
    setTitle(""); setContent("");
    await load();
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Prompt Library</h1>

      <form onSubmit={create} className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} required />
        <Textarea className="md:col-span-2" placeholder="Content" value={content} onChange={(e)=>setContent(e.target.value)} required />
        <div className="md:col-start-3"><Button className="w-full">Save prompt</Button></div>
      </form>

      <ul className="divide-y border rounded-md">
        {prompts.map((p) => (
          <li key={p.id} className="p-4">
            <div className="font-medium">{p.title}</div>
            <div className="text-sm text-muted-foreground">{p.content}</div>
          </li>
        ))}
        {prompts.length===0 && <li className="p-6 text-sm text-muted-foreground">No prompts yet.</li>}
      </ul>
    </main>
  );
}
