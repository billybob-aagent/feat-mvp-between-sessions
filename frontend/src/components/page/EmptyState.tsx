import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-8 text-center shadow-soft">
      <div className="text-sm font-medium text-app-text">{title}</div>
      {description && <p className="mt-2 text-sm text-app-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
