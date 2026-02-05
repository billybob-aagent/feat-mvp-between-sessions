import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function Select({ className, children, hasError, ...props }: SelectProps) {
  return (
    <select
      {...props}
      aria-invalid={hasError || undefined}
      className={`w-full rounded-md border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 ${hasError ? "border-app-danger" : "border-app-border"} ${className ?? ""}`}
    >
      {children}
    </select>
  );
}
