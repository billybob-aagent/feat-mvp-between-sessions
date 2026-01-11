import type { ReactNode } from "react";

type BaseProps = {
  children?: ReactNode;
  className?: string;
};

export function Table({ children, className }: BaseProps) {
  return (
    <div className={`border border-app-border rounded-lg overflow-hidden ${className ?? ""}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children, className }: BaseProps) {
  return <thead className={`bg-app-surface-2 text-left ${className ?? ""}`}>{children}</thead>;
}

export function TableBody({ children, className }: BaseProps) {
  return <tbody className={className}>{children}</tbody>;
}

export function TableRow({ children, className }: BaseProps) {
  return (
    <tr className={`border-t border-app-border hover:bg-app-surface-2 ${className ?? ""}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className }: BaseProps) {
  return <th className={`px-4 py-3 text-label text-app-muted ${className ?? ""}`}>{children}</th>;
}

export function TableCell({ children, className }: BaseProps) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}
