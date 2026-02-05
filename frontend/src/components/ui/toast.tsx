import type { ReactNode } from "react";

type ToastVariant = "neutral" | "success" | "warning" | "danger" | "info";

type ToastProps = {
  title?: string;
  description?: ReactNode;
  variant?: ToastVariant;
  onClose?: () => void;
};

const variantClasses: Record<ToastVariant, string> = {
  neutral: "border-app-border bg-app-surface text-app-text",
  success: "border-app-success/40 bg-app-success-soft text-app-success",
  warning: "border-app-warning/40 bg-app-warning-soft text-app-warning",
  danger: "border-app-danger/40 bg-app-danger-soft text-app-danger",
  info: "border-app-info/40 bg-app-info-soft text-app-info",
};

export function Toast({ title, description, variant = "neutral", onClose }: ToastProps) {
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-soft ${variantClasses[variant]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <div className="text-sm font-medium">{title}</div>}
          {description && <div className="text-xs mt-1">{description}</div>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-xs text-app-muted">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
