"use client";

import { useParams } from "next/navigation";
import { TraceView } from "@/components/trace/TraceView";

export default function ClientTracePage() {
  const params = useParams();
  const clientId = String(params.clientId);
  return <TraceView clientId={clientId} />;
}
