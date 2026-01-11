import type { ReactNode } from "react";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

type BadgeProps = {
  children?: ReactNode;
  className?: string;
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-app-surface-2 text-app-muted border-app-border",
  success: "bg-app-success-soft text-app-success border-app-success",
  warning: "bg-app-warning-soft text-app-warning border-app-warning",
  danger: "bg-app-danger-soft text-app-danger border-app-danger",
  info: "bg-app-info-soft text-app-info border-app-info",
};

export function Badge({ children, className, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium ${variantClasses[variant]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
