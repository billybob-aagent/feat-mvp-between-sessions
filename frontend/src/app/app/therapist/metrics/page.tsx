"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KPIs = { active_clients: number; assignments_this_week: number; responses_this_week: number; avg_mood: number | null };

export default function MetricsPage() {
  const [kpi, setKpi] = useState<KPIs | null>(null);
  useEffect(()=>{(async()=>{ try{ setKpi(await apiFetch("/metrics/overview")); }catch{}})();},[]);
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Engagement Metrics</h1>
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Active clients', value: kpi?.active_clients ?? '—' },
          { label: 'Assignments (7d)', value: kpi?.assignments_this_week ?? '—' },
          { label: 'Responses (7d)', value: kpi?.responses_this_week ?? '—' },
          { label: 'Avg mood (7d)', value: kpi?.avg_mood ?? '—' },
        ].map((x,i)=> (
          <Card key={i}><CardHeader><CardTitle className="text-sm">{x.label}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{x.value}</CardContent></Card>
        ))}
      </div>
    </main>
  );
}
