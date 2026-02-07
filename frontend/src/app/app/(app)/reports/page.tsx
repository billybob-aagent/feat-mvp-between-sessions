"use client";

import Link from "next/link";
import { RequireRole } from "@/components/auth/RequireRole";
import { PageLayout } from "@/components/page/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const cards = [
  {
    title: "AER (Client)",
    description: "Generate a single-client Adherence Evidence Report (JSON + PDF).",
    href: "/app/reports/aer",
  },
  {
    title: "AER Rollup",
    description: "Program-level adherence summary for clinic supervisors.",
    href: "/app/reports/rollup",
  },
  {
    title: "Supervisor Weekly Packet",
    description: "Weekly packet with top risk clients and escalation overlay.",
    href: "/app/reports/supervisor-weekly",
  },
  {
    title: "Submission Bundle (UR)",
    description: "Package AER and related artifacts with payer-safe language.",
    href: "/app/reports/submission",
  },
];

export default function ReportsIndexPage() {
  return (
    <RequireRole roles={["CLINIC_ADMIN", "admin", "therapist"]}>
      <PageLayout
        title="Reports"
        subtitle="Generate structured, audit-ready artifacts and supervisory rollups."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="group">
              <Card className="h-full transition group-hover:shadow-card">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs text-app-accent">Open report</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageLayout>
    </RequireRole>
  );
}
