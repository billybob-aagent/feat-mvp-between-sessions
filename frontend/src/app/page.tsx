import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/shell/PublicHeader";

export default function Home() {
  const checkout = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || "/auth/signup";
  return (
    <main className="min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Asynchronous care
            <br />
            designed for therapists
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Assign exercises, receive reflections, and close the loop with feedback — between sessions.
            Built for clinical calm. WCAG AA compliant.
          </p>
          <div className="mt-8 flex gap-4">
            <Link href={checkout}>
              <Button className="px-6">Start 14‑day free trial</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline" className="px-6">See pricing</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No medical advice. Not a replacement for therapy. Clinical support tool only.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>What you can do</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li>• Assign prompts with due dates and recurrence</li>
              <li>• Collect text and voice reflections</li>
              <li>• Daily mood check-ins</li>
              <li>• Send short, trackable feedback</li>
              <li>• See engagement and mood trends</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {["Calm & clinical", "Accessible by default", "Privacy-forward"].map((title, i) => (
          <Card key={i}>
            <CardHeader><CardTitle className="text-xl">{title}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {i===0 && "No clutter, just care. Interfaces that inspire therapist confidence."}
              {i===1 && "High contrast, large touch targets, keyboard friendly — WCAG AA."}
              {i===2 && "Encrypted PHI at rest, minimal surface area, clear reassurance copy."}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
          <Card><CardHeader><CardTitle>1. Assign</CardTitle></CardHeader><CardContent>Create an exercise or pick from your prompt library.</CardContent></Card>
          <Card><CardHeader><CardTitle>2. Reflect</CardTitle></CardHeader><CardContent>Clients submit text or voice responses and daily mood.</CardContent></Card>
          <Card><CardHeader><CardTitle>3. Feedback</CardTitle></CardHeader><CardContent>Send short notes and track engagement over time.</CardContent></Card>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">Therapists say</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
          <Card><CardContent className="pt-6">“My sessions are more focused because I know what happened between them.”</CardContent></Card>
          <Card><CardContent className="pt-6">“Clients love the low-friction check-ins. I love the signal.”</CardContent></Card>
          <Card><CardContent className="pt-6">“Quiet, quick, clinical. Exactly what I wanted.”</CardContent></Card>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Simple pricing</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Per‑therapist monthly plan. Cancel anytime. Stripe‑secured checkout.
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>$29/month</CardTitle></CardHeader>
            <CardContent>
              <Link href={checkout}><Button className="w-full">Go to checkout</Button></Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-6">FAQ</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <Card><CardHeader><CardTitle>Is this HIPAA compliant?</CardTitle></CardHeader><CardContent>We protect PHI at the application layer and integrate with compliant infrastructure. Business Associate Agreements available on request.</CardContent></Card>
          <Card><CardHeader><CardTitle>Does it replace therapy?</CardTitle></CardHeader><CardContent>No. It supports therapeutic work between sessions.</CardContent></Card>
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm text-gray-600">
        <div className="space-x-6">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} Therapy Is Us</p>
      </footer>
    </main>
  );
}
