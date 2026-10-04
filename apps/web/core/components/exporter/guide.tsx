import { useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ImportExportSettingsLoader } from "@/components/ui/loader/settings/import-and-export";
import { ExportForm } from "./export-form";
import { PrevExports } from "./prev-exports";

export function ExportGuide({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const settings = useQuery(api.exports.index.settings, { workspaceId });
  return (
    <div className="flex size-full flex-col gap-y-13">
      {settings === undefined ? (
        <ImportExportSettingsLoader />
      ) : (
        <ExportForm workspaceId={workspaceId} settings={settings} />
      )}
      <PrevExports workspaceId={workspaceId} />
    </div>
  );
}
