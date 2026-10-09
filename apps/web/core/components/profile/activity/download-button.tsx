/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { csvDownload } from "@plane/utils";

export function DownloadActivityButton({
  workspaceId,
  userId,
}: {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
}) {
  const convex = useConvex();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setError("");
    try {
      const csv = [
        ["Actor name", "Issue ID", "Project", "Created at", "Updated at", "Action", "Field", "Old value", "New value"],
      ];
      // Each continuation consumes the previous native day/timezone/cursor receipt.
      const collect = async (args: FunctionArgs<typeof api.tasks.activity.exportDay>): Promise<string> => {
        const result = await convex.query(api.tasks.activity.exportDay, args);
        for (const event of result.page) {
          const row = [
            event.actorName ?? "",
            event.projectIdentifier + " - " + event.sequence,
            event.projectName,
            new Date(event.at).toISOString(),
            "",
            event.kind,
          ];
          if (!event.changes?.length) {
            csv.push([...row, "", "", ""]);
            continue;
          }
          for (const change of event.changes) {
            const before = "before" in change ? change.before : change.removed;
            const after = "after" in change ? change.after : change.added;
            csv.push([
              ...row,
              change.field,
              typeof before === "string" ? before : JSON.stringify(before),
              typeof after === "string" ? after : JSON.stringify(after),
            ]);
          }
        }
        return result.isDone
          ? result.day
          : collect({
              ...args,
              day: result.day,
              timezone: result.timezone,
              paginationOpts: { numItems: 100, cursor: result.continueCursor },
            });
      };
      const day = await collect({ workspaceId, userId, paginationOpts: { numItems: 100, cursor: null } });
      csvDownload(csv, "profile-activity-" + day, { formulaProtection: "text" });
    } catch (failure) {
      setError(
        failure instanceof ConvexError && typeof failure.data === "string"
          ? failure.data
          : "Could not export activity. Check your connection and access, then try again."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <Button onClick={handleDownload} loading={isDownloading}>
        {isDownloading ? t("profile.stats.recent_activity.button_loading") : t("profile.stats.recent_activity.button")}
      </Button>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
