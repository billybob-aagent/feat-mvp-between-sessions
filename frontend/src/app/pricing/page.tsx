import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h1">Pricing</h1>
            <p className="mt-2 text-body text-app-muted">
              Simple pricing for therapists and clinics. Start with a 14-day free trial.
            </p>
          </div>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-md border border-app-border bg-app-accent px-4 py-2 text-sm text-white shadow-soft hover:bg-app-accent/90"
          >
            Start trial
          </Link>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-app-border bg-app-surface p-6 shadow-soft">
            <h2 className="text-h3">Monthly</h2>
            <p className="mt-3 text-3xl font-semibold">
              $49<span className="text-sm font-normal text-app-muted">/mo</span>
            </p>
            <ul className="mt-4 text-sm text-app-muted space-y-2">
              <li>Full therapist features</li>
              <li>Unlimited clients</li>
              <li>Email reminders</li>
            </ul>
            <Link
              href="/auth/signup"
              className="mt-6 inline-flex items-center justify-center rounded-md border border-app-border bg-app-accent px-4 py-2 text-sm text-white shadow-soft hover:bg-app-accent/90"
            >
              Start trial
            </Link>
          </div>

          <div className="rounded-lg border border-app-border bg-app-surface p-6 shadow-soft">
            <h2 className="text-h3">Annual</h2>
            <p className="mt-3 text-3xl font-semibold">
              $490<span className="text-sm font-normal text-app-muted">/yr</span>
            </p>
            <ul className="mt-4 text-sm text-app-muted space-y-2">
              <li>Two months free</li>
              <li>All monthly features</li>
              <li>Priority support</li>
            </ul>
            <Link
              href="/auth/signup"
              className="mt-6 inline-flex items-center justify-center rounded-md border border-app-border bg-app-accent px-4 py-2 text-sm text-white shadow-soft hover:bg-app-accent/90"
            >
              Start trial
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
