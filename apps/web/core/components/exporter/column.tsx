import { Download } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { renderFormattedDate } from "@plane/utils";
import { Badge } from "@plane/propel/badge";
import { Button } from "@plane/propel/button";
import { Avatar } from "@plane/ui";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";

type Row = FunctionReturnType<typeof api.exports.index.list>["page"][number];
const failures = {
  processing_failed: "Export failed. Start a new export after checking project access and the document worker.",
  deadline_exceeded: "Export timed out. Start a new export with fewer projects.",
} satisfies Record<NonNullable<Row["failure"]>, string>;
export function useExportColumns(download: (row: Row) => Promise<void>, pending: boolean) {
  return [
    {
      key: "Exported By",
      content: "Exported By",
      tdRender: (row: Row) => (
        <div className="flex items-center gap-x-2">
          {row.requesterAvatar ? (
            <span className="relative flex size-4 items-center justify-center overflow-hidden rounded-full">
              <AuthenticatedAssetImage
                asset={row.requesterAvatar}
                alt="Exporter avatar"
                className="absolute inset-0 size-full rounded-full object-cover"
              />
            </span>
          ) : (
            <Avatar name={row.requesterName} size={16} shape="circle" showTooltip={false} />
          )}
          <span>{row.requesterName}</span>
        </div>
      ),
    },
    {
      key: "Exported On",
      content: "Exported On",
      tdRender: (row: Row) => <span>{renderFormattedDate(new Date(row.createdAt))}</span>,
    },
    {
      key: "Exported projects",
      content: "Exported projects",
      tdRender: (row: Row) => <span className="text-13">{row.projectCount} project(s)</span>,
    },
    { key: "Format", content: "Format", tdRender: (row: Row) => <span className="text-13">{row.formatLabel}</span> },
    {
      key: "Status",
      content: "Status",
      tdRender: (row: Row) => (
        <div>
          <Badge variant={row.status === "completed" ? "success" : row.status === "failed" ? "danger" : "neutral"}>
            {row.status}
          </Badge>
          {row.failure && <p className="max-w-64 text-11 text-danger-primary">{failures[row.failure]}</p>}
        </div>
      ),
    },
    {
      key: "Download",
      content: "Download",
      tdRender: (row: Row) =>
        row.artifact ? (
          <Button
            variant="tertiary"
            disabled={pending}
            prependIcon={<Download className="size-4" />}
            onClick={() => void download(row)}
          >
            Download
          </Button>
        ) : (
          <span className="text-11 text-secondary">{row.status === "expired" ? "Expired" : "Unavailable"}</span>
        ),
    },
  ];
}
