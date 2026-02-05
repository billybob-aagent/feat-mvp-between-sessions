"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ErrorState({
  title = "Something went wrong",
  message,
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string | null;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="border-app-danger/40 bg-app-danger-soft">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-app-danger">{title}</div>
          {message ? (
            <p className="text-sm text-app-muted mt-1 whitespace-pre-wrap">{message}</p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <Button type="button" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
