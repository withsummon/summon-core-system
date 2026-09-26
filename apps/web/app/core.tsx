import { CoreWorkspace } from "@/components/convex-core/core-workspace";
import { CoreProvider } from "@/components/convex-core/provider";

export default function CoreRoute() {
  return (
    <CoreProvider>
      <CoreWorkspace />
    </CoreProvider>
  );
}
