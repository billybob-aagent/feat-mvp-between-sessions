import { Suspense } from "react";
import SignupClient from "./SignupClient";

export const dynamic = "force-dynamic";

function SignupFallback() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="rounded-xl border border-app-border bg-app-surface p-6 text-sm text-app-muted">
          Loading sign-up...
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupClient />
    </Suspense>
  );
}
