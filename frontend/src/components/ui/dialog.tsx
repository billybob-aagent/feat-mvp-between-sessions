"use client";

import type { ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        className="relative z-10 w-full max-w-lg rounded-xl border border-app-border bg-app-surface shadow-pop"
      >
        {title && (
          <div className="border-b border-app-border px-5 py-4">
            <h2 id="dialog-title" className="text-h3">
              {title}
            </h2>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-app-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
