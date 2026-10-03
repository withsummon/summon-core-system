import { useOutletContext } from "react-router";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { Clients } from "@/components/convex-core/commercial/clients";

export default function SummonClientsPage() {
  const { workspace } = useOutletContext<WorkspaceSession>();
  return <Clients workspace={workspace} />;
}
