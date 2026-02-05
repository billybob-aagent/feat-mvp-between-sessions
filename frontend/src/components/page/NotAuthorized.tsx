import Link from "next/link";

export function NotAuthorized({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-8 text-center shadow-soft">
      <h2 className="text-h3 text-app-text">Not authorized</h2>
      <p className="mt-2 text-sm text-app-muted">
        {message ?? "You do not have access to this area."}
      </p>
      <div className="mt-4">
        <Link href="/auth/login" className="text-sm text-app-accent hover:underline">
          Sign in with a different account
        </Link>
      </div>
    </div>
  );
}
