"use client";

import { Card, CardContent } from "@/components/ui/card";

export function FilterBar({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap items-end gap-4 flex-1">{children}</div>
        {actions ? <div className="flex items-center gap-2 ml-auto">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
