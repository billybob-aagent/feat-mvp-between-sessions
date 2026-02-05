import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";

type PageLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
};

export function PageLayout({ title, subtitle, actions, filters, children }: PageLayoutProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {filters && (
        <div className="rounded-lg border border-app-border bg-app-surface p-4 shadow-soft">
          {filters}
        </div>
      )}
      {children}
    </div>
  );
}
