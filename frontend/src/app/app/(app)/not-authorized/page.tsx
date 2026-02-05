import { NotAuthorized } from "@/components/page/NotAuthorized";

export default function NotAuthorizedPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-lg w-full">
        <NotAuthorized />
      </div>
    </div>
  );
}
