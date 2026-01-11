import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-app-accent text-white border-transparent hover:bg-app-accent/90",
  secondary: "bg-app-surface text-app-text border-app-border hover:bg-app-surface-2",
  ghost: "bg-transparent text-app-text border-transparent hover:bg-app-surface-2",
};

export function Button({ children, className, variant = "secondary", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
