import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-app-accent text-white border-transparent hover:bg-app-accent/90 shadow-soft",
  secondary:
    "bg-app-surface text-app-text border-app-border hover:bg-app-surface-2 shadow-soft",
  ghost: "bg-transparent text-app-text border-transparent hover:bg-app-surface-2",
  danger:
    "bg-app-danger text-white border-transparent hover:bg-app-danger/90 shadow-soft",
  outline:
    "bg-transparent text-app-text border-app-border hover:bg-app-surface-2",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
  );
}

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  isLoading,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/30 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ""}`}
    >
      {isLoading ? <Spinner /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
}
