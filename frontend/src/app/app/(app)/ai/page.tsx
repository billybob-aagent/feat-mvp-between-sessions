"use client";

import Link from "next/link";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const cards = [
  {
    title: "AI Settings",
    description: "Enable or disable AI at the clinic level.",
    href: "/app/ai/settings",
  },
  {
    title: "Adherence Assist",
    description: "Draft evidence summaries for between-session adherence.",
    href: "/app/ai/adherence-assist",
  },
  {
    title: "Assessment Assist",
    description: "Draft structured assessment sections from clinician inputs.",
    href: "/app/ai/assessment-assist",
  },
  {
    title: "Dry Run",
    description: "Inspect sanitization and redaction without calling any provider.",
    href: "/app/ai/dry-run",
  },
];

export default function AiIndexPage() {
  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="AI Assist"
        subtitle="Draft-only AI helpers governed by safety gateway policies."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="group">
              <Card className="h-full transition group-hover:shadow-card">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs text-app-accent">Open tool</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageLayout>
    </RequireRole>
  );
}
