import { Suspense } from "react";
import AcceptClinicInviteClient from "./AcceptClinicInviteClient";

export const dynamic = "force-dynamic";

function AcceptClinicInviteFallback() {
  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="rounded-xl border border-app-border bg-app-surface p-6 text-sm text-app-muted">
          Loading clinic invite...
        </div>
      </div>
    </main>
  );
}

export default function AcceptClinicInvitePage() {
  return (
    <Suspense fallback={<AcceptClinicInviteFallback />}>
      <AcceptClinicInviteClient />
    </Suspense>
  );
}
