import { useParams, useSearchParams } from "react-router";
import { IssuesLayoutsRoot } from "@/components/issues/issue-layouts";
import { usePublish } from "@/hooks/store/publish";

export default function IssuesPage() {
  const { anchor } = useParams();
  const [params] = useSearchParams();
  const publishSettings = usePublish(anchor ?? "");
  if (!publishSettings) return null;
  return <IssuesLayoutsRoot peekId={params.get("peekId") ?? undefined} publishSettings={publishSettings} />;
}
