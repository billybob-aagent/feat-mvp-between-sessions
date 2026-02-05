import type { LabelHTMLAttributes, ReactNode } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children?: ReactNode;
};

export function Label({ children, className, ...props }: LabelProps) {
  return (
    <label
      {...props}
      className={`text-label text-app-muted ${className ?? ""}`}
    >
      {children}
    </label>
  );
}
