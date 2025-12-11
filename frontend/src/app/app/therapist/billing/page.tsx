"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const portal = process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL || "#";
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="text-sm text-muted-foreground">Manage your subscription and invoices in the Stripe customer portal.</p>
      <Link href={portal}><Button>Open billing portal</Button></Link>
    </main>
  );
}
