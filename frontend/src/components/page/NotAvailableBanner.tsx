import { Alert } from "../ui/alert";

type Props = {
  items?: string[] | null;
};

export function NotAvailableBanner({ items }: Props) {
  if (!items || items.length === 0) return null;
  return (
    <Alert title="Some fields are not available" variant="warning">
      <ul className="list-disc pl-5 space-y-1">
        {items.map((item, idx) => (
          <li key={`${item}-${idx}`}>{item}</li>
        ))}
      </ul>
    </Alert>
  );
}
