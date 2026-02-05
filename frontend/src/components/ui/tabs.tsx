import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ items, value, onChange, className }: TabsProps) {
  return (
    <div className={`inline-flex rounded-lg border border-app-border bg-app-surface-2 p-1 ${className ?? ""}`}>
      {items.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${active ? "bg-app-surface text-app-text shadow-soft" : "text-app-muted hover:text-app-text"} ${tab.disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
