/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { Avatar } from "@plane/propel/avatar";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { PageIcon } from "@plane/propel/icons";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { Earth, LockKeyhole, Info } from "lucide-react";
import { Tooltip } from "@plane/propel/tooltip";
import { getPageName } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { ListItem, ListLayout } from "@/components/core/list";
import { PageTabNavigation } from "@/components/pages/list/tab-navigation";
import { PageOrderByDropdown } from "@/components/pages/list/order-by";
import { PageSearchInput } from "@/components/pages/list/search-input";
import { PageLoader } from "@/components/pages/loaders/page-loader";
import { Header, EHeaderVariant } from "@plane/ui";
import { DocumentActions } from "@/components/convex-core/documents/documents";
import { PagesListHeader } from "./header";

export default function ProjectPagesPage() {
  const address = useOutletContext<FunctionReturnType<typeof api.navigation.address.resolveProjectId>>();
  const [params] = useSearchParams();
  const type = params.get("type");
  const pageType = type === "private" || type === "archived" ? type : "public";
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] =
    useState<NonNullable<FunctionArgs<typeof api.documents.index.list>["sortKey"]>>("updated_at");
  const [sortBy, setSortBy] = useState<NonNullable<FunctionArgs<typeof api.documents.index.list>["sortBy"]>>("desc");
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.index.list,
    {
      workspaceId: address.workspace._id,
      projectId: address.project._id,
      pageType,
      search,
      sortKey,
      sortBy,
    },
    { initialNumItems: 50 }
  );
  const { t } = useTranslation();
  const canCreate = address.workspaceRole !== "guest" && address.projectRole !== "guest";
  return (
    <>
      <PageHead title={`${address.project.name} - Pages`} />
      <PagesListHeader address={address} pageType={pageType} canCreate={canCreate} />
      <Header variant={EHeaderVariant.SECONDARY} className="shrink-0 border-b border-subtle">
        <Header.LeftItem>
          <PageTabNavigation
            workspaceSlug={address.workspace.slug}
            projectId={address.project._id}
            pageType={pageType}
          />
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <PageSearchInput searchQuery={search} updateSearchQuery={setSearch} />
          <PageOrderByDropdown
            sortKey={sortKey}
            sortBy={sortBy}
            onChange={({ key, order }) => {
              if (key) setSortKey(key);
              if (order) setSortBy(order);
            }}
          />
        </Header.RightItem>
      </Header>
      {status === "LoadingFirstPage" ? (
        <PageLoader />
      ) : results.length === 0 && status === "Exhausted" ? (
        <EmptyStateDetailed
          assetKey={search ? "search" : "page"}
          title={t(
            search
              ? "common_empty_state.search.title"
              : pageType === "archived"
                ? "project_empty_state.archive_pages.title"
                : "project_empty_state.pages.title"
          )}
          description={t(
            search
              ? "common_empty_state.search.description"
              : pageType === "archived"
                ? "project_empty_state.archive_pages.description"
                : "project_empty_state.pages.description"
          )}
        />
      ) : (
        <ListLayout>
          {results.map((row) => (
            <ProjectPageRow key={row.document._id} row={row} address={address} />
          ))}
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <div className="p-4">
              <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(50)}>
                Load more pages
              </Button>
            </div>
          )}
        </ListLayout>
      )}
    </>
  );
}

function ProjectPageRow({
  row,
  address,
}: {
  row: FunctionReturnType<typeof api.documents.index.list>["page"][number];
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { document, owner, logo, canManage } = row;
  return (
    <ListItem
      parentRef={parentRef}
      title={getPageName(document.name)}
      itemLink={`/${address.workspace.slug}/projects/${address.project._id}/pages/${document._id}`}
      prependTitleElement={
        logo ? <Logo logo={logo} size={16} type="lucide" /> : <PageIcon className="size-4 text-tertiary" />
      }
      actionableItems={
        <>
          <Tooltip tooltipHeading="Owned by" tooltipContent={owner.name}>
            <span>
              {owner.avatar ? (
                <AuthenticatedAssetImage
                  asset={owner.avatar}
                  alt="Page owner avatar"
                  compactName={owner.name ?? ""}
                  className="size-5 rounded-full"
                />
              ) : (
                <Avatar name={owner.name ?? undefined} size="md" />
              )}
            </span>
          </Tooltip>
          <Tooltip tooltipContent={document.access === "public" ? "Public" : "Private"}>
            <span>
              {document.access === "public" ? (
                <Earth className="size-4 text-tertiary" />
              ) : (
                <LockKeyhole className="size-4 text-tertiary" />
              )}
            </span>
          </Tooltip>
          <Tooltip tooltipContent={`Created on ${new Date(document._creationTime).toLocaleDateString()}`}>
            <Info className="size-4 text-tertiary" />
          </Tooltip>
          <DocumentActions
            document={document}
            workspaceSlug={address.workspace.slug}
            projectId={address.project._id}
            canManage={canManage}
          />
        </>
      }
    />
  );
}
