/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import { useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { DraftIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { CountChip } from "@/components/common/count-chip";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import type { WorkspaceDraftSession } from "./layout";

export function WorkspaceDraftHeader({ session }: { session: WorkspaceDraftSession }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const deleted = params.get("draftView") === "trash";
  const projects = useQuery(api.projects.index.list, { workspaceId: session.workspace._id });
  return (
    <Header className="max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:py-2">
      <Header.LeftItem className="max-sm:max-w-full">
        <div className="flex flex-wrap items-center gap-2.5">
          <Breadcrumbs>
            <Breadcrumbs.Item
              component={<BreadcrumbLink label={t("drafts")} icon={<DraftIcon className="size-4 text-tertiary" />} />}
            />
          </Breadcrumbs>
          {session.drafts.status === "Exhausted" && session.drafts.results.length > 0 && (
            <CountChip count={session.drafts.results.length} />
          )}
          <nav aria-label="Draft views" className="flex gap-2">
            <Button size="sm" variant={!deleted ? "primary" : "ghost"} onClick={() => setParams({})}>
              Drafts
            </Button>
            <Button size="sm" variant={deleted ? "primary" : "ghost"} onClick={() => setParams({ draftView: "trash" })}>
              Trash
            </Button>
          </nav>
        </div>
      </Header.LeftItem>
      <Header.RightItem className="max-sm:w-full">
        {!!projects?.length && !deleted && (
          <Button
            variant="primary"
            size="lg"
            className="items-center gap-1"
            onClick={() => void session.createDraft()}
            loading={session.creatingDraft}
            disabled={session.workspace.membershipRole === "guest"}
          >
            {t("workspace_draft_issues.draft_an_issue")}
          </Button>
        )}
      </Header.RightItem>
    </Header>
  );
}
