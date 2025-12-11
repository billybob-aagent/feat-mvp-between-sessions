import Link from "next/link";
import { ReactNode } from "react";

export default function TherapistLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-[260px_1fr]">
      <aside className="border-r p-4 space-y-4">
        <div className="text-lg font-semibold">Between Sessions™</div>
        <nav className="flex flex-col gap-2 text-sm">
          <Link className="hover:underline" href="/app/therapist/dashboard">Overview</Link>
          <Link className="hover:underline" href="/app/therapist/clients">Clients</Link>
          <Link className="hover:underline" href="/app/therapist/prompts">Prompt Library</Link>
          <Link className="hover:underline" href="/app/therapist/assignments">Assignment Builder</Link>
          <Link className="hover:underline" href="/app/therapist/feedback">Feedback</Link>
          <Link className="hover:underline" href="/app/therapist/metrics">Engagement Metrics</Link>
          <Link className="hover:underline" href="/app/therapist/billing">Billing</Link>
          <Link className="hover:underline" href="/app/therapist/settings">Account Settings</Link>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
