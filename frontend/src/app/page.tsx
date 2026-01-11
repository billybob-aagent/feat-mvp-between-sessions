import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <header className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
        <div className="text-h3">Between Sessions</div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/pricing" className="text-app-muted hover:text-app-text">
            Pricing
          </Link>
          <Link href="/auth/login" className="text-app-muted hover:text-app-text">
            Login
          </Link>
          <Link
            href="/auth/login?next=/app/clinic/dashboard"
            className="text-app-muted hover:text-app-text"
          >
            Clinic Login
          </Link>
          <Link
            href="/auth/signup?role=clinic"
            className="text-app-muted hover:text-app-text"
          >
            Clinic Signup
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-md border border-app-border bg-app-accent px-4 py-2 text-xs text-white shadow-soft hover:bg-app-accent/90"
          >
            Get Started
          </Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-label text-app-muted">Clinical support platform</p>
          <h1 className="text-h1 mt-2">
            A calm, private space for between-session care
          </h1>
          <p className="mt-4 text-body text-app-muted">
            Assign structured exercises, gather reflections, and keep care moving
            between sessions with privacy-first workflows.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-md border border-app-border bg-app-accent px-5 py-2 text-sm text-white shadow-soft hover:bg-app-accent/90"
            >
              Start 14-day free trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md border border-app-border bg-app-surface px-5 py-2 text-sm text-app-text shadow-soft hover:bg-app-surface-2"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <Link
              href="/auth/login?next=/app/clinic/dashboard"
              className="text-app-muted hover:text-app-text"
            >
              Clinic Admin Login
            </Link>
            <Link
              href="/auth/signup?role=clinic"
              className="text-app-muted hover:text-app-text"
            >
              Clinic Admin Signup
            </Link>
          </div>
          <p className="mt-4 text-xs text-app-muted">
            Not a medical device. Not a replacement for therapy.
          </p>
        </div>

        <div className="rounded-lg border border-app-border bg-app-surface p-6 shadow-soft">
          <div className="text-h3">Why teams choose Between Sessions</div>
          <ul className="mt-4 space-y-3 text-sm text-app-muted">
            <li>Assign prompts with due dates and recurrence</li>
            <li>Collect text and voice reflections securely</li>
            <li>Capture daily mood check-ins and trends</li>
            <li>Deliver concise therapist feedback loops</li>
            <li>Stay aligned with client engagement signals</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-app-border py-8 text-center text-xs text-app-muted">
        <div className="space-x-6">
          <Link href="/privacy" className="hover:text-app-text">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-app-text">
            Terms
          </Link>
        </div>
        <p className="mt-4">© {new Date().getFullYear()} Therapy Is Us</p>
      </footer>
    </main>
  );
}
