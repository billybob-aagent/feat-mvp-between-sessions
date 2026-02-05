import type { ReactNode } from "react";
import { Card, CardContent } from "../ui/card";

export function StatCard({ label, value, helper, icon }: { label: string; value: ReactNode; helper?: string; icon?: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-label text-app-muted">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-app-text">{value}</div>
            {helper && <div className="mt-1 text-xs text-app-muted">{helper}</div>}
          </div>
          {icon && <div className="text-app-muted">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
