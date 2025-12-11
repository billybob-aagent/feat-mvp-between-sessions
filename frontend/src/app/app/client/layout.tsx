import Link from "next/link";
import { ReactNode } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
        <div className="font-semibold">Between Sessions™</div>
        <nav className="text-sm flex gap-4">
          <Link href="/app/client/assignments" className="hover:underline">Assignments</Link>
          <Link href="/app/client/checkin" className="hover:underline">Daily check‑in</Link>
          <Link href="/app/client/feedback" className="hover:underline">Feedback</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
