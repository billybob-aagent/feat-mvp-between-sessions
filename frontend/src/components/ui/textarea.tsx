import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function Textarea({ className, hasError, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      aria-invalid={hasError || undefined}
      className={`w-full rounded-md border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-muted shadow-soft transition focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 ${hasError ? "border-app-danger" : "border-app-border"} ${className ?? ""}`}
    />
  );
}
