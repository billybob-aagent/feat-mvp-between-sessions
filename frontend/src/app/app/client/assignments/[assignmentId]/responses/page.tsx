import { redirect } from "next/navigation";

export default function ClientAssignmentLegacyResponsesPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  redirect(`/app/client/assignments/${params.assignmentId}`);
}

