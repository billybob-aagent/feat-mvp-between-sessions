import type { ReactNode } from "react";

type AlertVariant = "info" | "warning" | "danger" | "success" | "neutral";

type AlertProps = {
  title?: string;
  children?: ReactNode;
  variant?: AlertVariant;
  className?: string;
};

const variantClasses: Record<AlertVariant, string> = {
  info: "border-app-info/40 bg-app-info-soft text-app-info",
  warning: "border-app-warning/40 bg-app-warning-soft text-app-warning",
  danger: "border-app-danger/40 bg-app-danger-soft text-app-danger",
  success: "border-app-success/40 bg-app-success-soft text-app-success",
  neutral: "border-app-border bg-app-surface-2 text-app-text",
};

export function Alert({ title, children, variant = "neutral", className }: AlertProps) {
  const role = variant === "danger" ? "alert" : "status";
  return (
    <div
      role={role}
      className={`rounded-lg border px-4 py-3 text-sm ${variantClasses[variant]} ${className ?? ""}`}
    >
      {title && <div className="font-medium mb-1">{title}</div>}
      {children}
    </div>
  );
}
