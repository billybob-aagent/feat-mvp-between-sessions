import { redirect } from "next/navigation";

export default function ClientIndexPage() {
  redirect("/app/client/assignments");
}
