import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckinPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-h2">Daily check-ins</h1>
          <p className="text-sm text-app-muted">Coming soon.</p>
        </div>
        <Link href="/app/client/assignments" className="text-sm text-app-muted hover:text-app-text">
          Back to check-ins
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily check-ins are not part of the MVP</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-app-muted">
            For now, please use the check-ins assigned by your therapist.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
