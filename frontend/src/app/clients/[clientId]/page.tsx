import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function toQuery(searchParams?: SearchParams) {
  if (!searchParams) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function Page({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams?: SearchParams;
}) {
  redirect(`/app/clients/${params.clientId}${toQuery(searchParams)}`);
}
