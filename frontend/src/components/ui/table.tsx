import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

type BaseProps = {
  children?: ReactNode;
  className?: string;
};

export function Table({ children, className }: BaseProps) {
  return (
    <div className={`border border-app-border rounded-lg overflow-hidden ${className ?? ""}`}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className }: BaseProps) {
  return (
    <thead className={`bg-app-surface-2 text-left sticky top-0 z-10 ${className ?? ""}`}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className }: BaseProps) {
  return <tbody className={className}>{children}</tbody>;
}

type TableRowProps = HTMLAttributes<HTMLTableRowElement> & BaseProps;

export function TableRow({ children, className, ...props }: TableRowProps) {
  return (
    <tr
      {...props}
      className={`border-t border-app-border hover:bg-app-surface-2 ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}

type TableHeadProps = ThHTMLAttributes<HTMLTableCellElement> & BaseProps;

export function TableHead({ children, className, ...props }: TableHeadProps) {
  return (
    <th
      {...props}
      className={`sticky top-0 bg-app-surface-2 px-4 py-3 text-label text-app-muted ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

type TableCellProps = TdHTMLAttributes<HTMLTableCellElement> & BaseProps;

export function TableCell({ children, className, ...props }: TableCellProps) {
  return (
    <td {...props} className={`px-4 py-3 align-top ${className ?? ""}`}>
      {children}
    </td>
  );
}
