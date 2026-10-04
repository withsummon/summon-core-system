import { useEffect, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { MoveLeft, MoveRight, RefreshCw } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Table } from "@plane/ui";
import { AssetTransfers } from "@/components/convex-core/documents/asset-transfers";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { ImportExportSettingsLoader } from "@/components/ui/loader/settings/import-and-export";
import { useExportColumns } from "./column";

export function PrevExports({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const { t } = useTranslation();
  const client = useConvex();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const args = { workspaceId, paginationOpts: { numItems: 10, cursor: cursors[cursors.length - 1] } };
  const exports = useQuery(api.exports.index.list, args);
  const [transfers] = useState(() => new AssetTransfers());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => transfers.dispose(), [transfers]);
  useReloadConfirmations(pending, "The export download is still in progress.", undefined, pending);
  const run = async (operation: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  };
  const download = (row: FunctionReturnType<typeof api.exports.index.list>["page"][number]) =>
    run(async () => {
      if (!row.artifact) return;
      const artifact = row.artifact;
      await transfers.run(async (signal) => {
        const url = transfers.objectUrl(await transfers.download(artifact, signal), signal);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = artifact.name;
          link.click();
        } finally {
          transfers.release(url);
        }
      });
    });
  const columns = useExportColumns(download, pending);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3.5">
        <div className="flex items-center gap-2">
          <h3 className="text-h6-medium text-primary">{t("workspace_settings.settings.exports.previous_exports")}</h3>
          <Button
            variant="tertiary"
            disabled={pending}
            onClick={() =>
              void run(async () => {
                await client.query(api.exports.index.list, args);
              })
            }
          >
            <RefreshCw className="size-3" />
            {t("refresh_status")}
          </Button>
        </div>
        <div className="flex gap-2 text-11">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || cursors.length === 1}
            onClick={() => setCursors((current) => current.slice(0, -1))}
            prependIcon={<MoveLeft />}
          >
            {t("prev")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !exports || exports.isDone}
            onClick={() => {
              if (exports && !exports.isDone) setCursors((current) => [...current, exports.continueCursor]);
            }}
            appendIcon={<MoveRight />}
          >
            {t("next")}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="py-2 text-13 text-danger-primary">
          {error}
        </p>
      )}
      {exports === undefined ? (
        <ImportExportSettingsLoader />
      ) : exports.page.length ? (
        <div className="overflow-x-auto">
          <Table
            columns={columns}
            data={exports.page}
            keyExtractor={(row) => row.id}
            tHeadClassName="border-b border-subtle"
            thClassName="text-left font-medium divide-x-0 text-placeholder"
            tBodyClassName="divide-y-0"
            tBodyTrClassName="divide-x-0 p-4 h-[40px] text-secondary"
            tHeadTrClassName="divide-x-0"
          />
        </div>
      ) : (
        <EmptyStateCompact
          assetKey="export"
          title={t("settings_empty_state.exports.title")}
          description={t("settings_empty_state.exports.description")}
          align="start"
          rootClassName="py-20"
        />
      )}
    </div>
  );
}
