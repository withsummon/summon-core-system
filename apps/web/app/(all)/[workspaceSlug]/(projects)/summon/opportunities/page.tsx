import { useOutletContext } from "react-router";
import type { WorkspaceSession } from "@/app/native-workspace";
import { Opportunities } from "@/components/convex-core/commercial/opportunities";

export default function SummonOpportunitiesPage() {
  const { workspace } = useOutletContext<WorkspaceSession>();
  return <Opportunities workspace={workspace} />;
}
