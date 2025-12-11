"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TimelineItem = { id: string; type: "assignment"|"response"|"feedback"|"checkin"; at: string; summary: string };

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id as string;
  const [name, setName] = useState("Client");
  const [items, setItems] = useState<TimelineItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiFetch(`/clients/${clientId}`);
        setName(c.full_name || "Client");
      } catch {}
      try {
        const data = (await apiFetch(`/clients/${clientId}/timeline`)) as TimelineItem[];
        setItems(data);
      } catch {}
    })();
  }, [clientId]);

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{name}</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {items.map((it)=> (
                <li key={it.id} className="text-sm">
                  <span className="font-medium capitalize">{it.type}</span> · {new Date(it.at).toLocaleString()} — {it.summary}
                </li>
              ))}
              {items.length===0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Assign a prompt or send a quick note from the sections on the left.</CardContent>
        </Card>
      </div>
    </main>
  );
}
