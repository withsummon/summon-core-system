/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import Link from "next/link";
import { ContentOverflowWrapper } from "@/components/core/content-overflow-HOC";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "@plane/i18n";
import { PlusIcon } from "@plane/propel/icons";
import { ContentWrapper, EModalWidth, ModalCore } from "@plane/ui";
import { Row } from "@plane/ui";
import { ContentWrapper as RouteContentWrapper } from "@/components/core/content-wrapper";
import { StickyHeaderView } from "../header-view";
import { PageHead } from "@/components/core/page-title";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { SimpleEmptyState } from "@/components/empty-state/simple-empty-state-root";
import darkStickiesAsset from "@/app/assets/empty-state/stickies/stickies-dark.webp?url";
import lightStickiesAsset from "@/app/assets/empty-state/stickies/stickies-light.webp?url";
import darkSearchAsset from "@/app/assets/empty-state/stickies/stickies-search-dark.webp?url";
import lightSearchAsset from "@/app/assets/empty-state/stickies/stickies-search-light.webp?url";
import { StickyColumns, StickyMasonry } from "../layout/grid";
import { StickiesLoader } from "../layout/stickies-loader";
import { StickySearchView } from "../modal/search-view";
import { NativeStickyNote } from "./note";
import { useNativeStickies } from "./provider";
import { StickiesModalView } from "../modal/view";
import { NativeStickyDraggable } from "./drag";
export function NativeStickySearch() {
  const { search, setSearch } = useNativeStickies();
  return <StickySearchView searchQuery={search} updateSearchQuery={setSearch} />;
}
function EmptyStickies() {
  const { query, creating, create } = useNativeStickies();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <div className="grid size-full place-items-center">
      {query ? (
        <SimpleEmptyState
          title={t("stickies.empty_state.search.title")}
          description={t("stickies.empty_state.search.description")}
          assetPath={resolvedTheme === "light" ? lightSearchAsset : darkSearchAsset}
        />
      ) : (
        <DetailedEmptyState
          title={t("stickies.empty_state.general.title")}
          description={t("stickies.empty_state.general.description")}
          assetPath={resolvedTheme === "light" ? lightStickiesAsset : darkStickiesAsset}
          primaryButton={{
            prependIcon: <PlusIcon className="size-4" />,
            text: t("stickies.empty_state.general.primary_button.text"),
            onClick: () => {
              void create();
            },
            disabled: creating,
          }}
        />
      )}
    </div>
  );
}
function NativeStickyList() {
  const { results, status, loadMore, error } = useNativeStickies();
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== "CanLoadMore" || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore(20);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [status, loadMore, results.length]);
  // A sparse search page is not an empty result set until its cursor is exhausted.
  useEffect(() => {
    if (!results.length && status === "CanLoadMore") loadMore(20);
  }, [results.length, status, loadMore]);
  return (
    <>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      {status === "LoadingFirstPage" || (!results.length && status !== "Exhausted") ? (
        <StickiesLoader />
      ) : !results.length ? (
        <EmptyStickies />
      ) : (
        <StickyColumns>
          {(columns) => (
            <StickyMasonry>
              {results.map((row) => (
                <NativeStickyDraggable key={row._id} row={row} itemWidth={`${100 / columns}%`}>
                  <NativeStickyNote row={row} />
                </NativeStickyDraggable>
              ))}
              {status !== "Exhausted" && (
                <div
                  ref={sentinel}
                  style={{ width: `${100 / columns}%` }}
                  className="box-border flex min-h-[300px] p-2"
                >
                  <button type="button" disabled={status !== "CanLoadMore"} onClick={() => loadMore(20)}>
                    Load more stickies
                  </button>
                </div>
              )}
            </StickyMasonry>
          )}
        </StickyColumns>
      )}
    </>
  );
}
function NativeStickyHeaderFrame({ header }: { header: React.ReactNode }) {
  return (
    <div className="z-[18]">
      <Row className="flex h-11 w-full items-center gap-2 border-b border-subtle bg-surface-1">
        <div className="w-full">{header}</div>
      </Row>
    </div>
  );
}
export function NativeStickiesPage() {
  const { create, creating } = useNativeStickies();
  return (
    <>
      <NativeStickyHeaderFrame
        header={
          <StickyHeaderView
            search={<NativeStickySearch />}
            creatingSticky={creating}
            create={() => {
              void create();
            }}
          />
        }
      />
      <RouteContentWrapper>
        <PageHead title="Your stickies" />
        <div className="relative h-full w-full overflow-hidden overflow-y-auto">
          <ContentWrapper className="space-y-4">
            <NativeStickyList />
          </ContentWrapper>
        </div>
      </RouteContentWrapper>
    </>
  );
}
export function NativeStickiesModal() {
  const { allOpen, closeAll, creating, create, workspaceSlug } = useNativeStickies();
  const { t } = useTranslation();
  return (
    <ModalCore isOpen={allOpen} handleClose={closeAll} width={EModalWidth.VXL}>
      <StickiesModalView
        handleClose={closeAll}
        creatingSticky={creating}
        create={() => {
          void create();
        }}
        search={<NativeStickySearch />}
      >
        <ContentOverflowWrapper
          maxHeight={620}
          containerClassName="pb-2 box-border"
          fallback={null}
          customButton={
            <Link
              href={`/${workspaceSlug}/stickies`}
              className="w-full gap-1 bg-surface-2/20 text-13 font-medium text-accent-primary transition-opacity duration-300"
              onClick={closeAll}
            >
              {t("show_all")}
            </Link>
          }
        >
          <NativeStickyList />
        </ContentOverflowWrapper>
      </StickiesModalView>
    </ModalCore>
  );
}
