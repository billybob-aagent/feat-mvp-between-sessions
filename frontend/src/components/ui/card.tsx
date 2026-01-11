import type { ReactNode } from "react";

type BaseProps = {
  children?: ReactNode;
  className?: string;
};

export function Card({ children, className }: BaseProps) {
  return (
    <div
      className={`bg-app-surface border border-app-border rounded-lg shadow-soft ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: BaseProps) {
  return (
    <div className={`px-5 py-4 border-b border-app-border ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: BaseProps) {
  return <div className={`text-h3 ${className ?? ""}`}>{children}</div>;
}

export function CardContent({ children, className }: BaseProps) {
  return <div className={`px-5 py-4 ${className ?? ""}`}>{children}</div>;
}
