"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setStatus(null);
    await apiFetch("/therapists/settings", { method: "POST", body: JSON.stringify({ full_name: name, timezone }) });
    setStatus("Saved");
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Account Settings</h1>
      <form onSubmit={save} className="max-w-xl space-y-3">
        <div>
          <label className="text-sm">Full name</label>
          <Input value={name} onChange={(e)=>setName(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm">Timezone</label>
          <Input value={timezone} onChange={(e)=>setTimezone(e.target.value)} placeholder="e.g., America/Los_Angeles" />
        </div>
        <Button>Save changes</Button>
        {status && <div className="text-sm text-muted-foreground">{status}</div>}
      </form>
    </main>
  );
}
