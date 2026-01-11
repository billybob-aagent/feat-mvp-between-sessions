import { redirect } from "next/navigation";

export default function ClientCheckinsRedirectPage() {
  redirect("/app/client/assignments");
}
