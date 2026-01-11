import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text shadow-soft ${className ?? ""}`}
    >
      {children}
    </select>
  );
}
