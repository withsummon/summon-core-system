/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import type { TIssueGroupByOptions } from "@plane/types";
// components
import { ListLoaderItemRow } from "@/components/ui/loader/layouts/list-layout-loader";
// hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";

type Props = {
  groupId: string;
  groupBy: TIssueGroupByOptions | null;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  loadMoreIssues: (groupId?: string) => void;
};

/** Grouped lists page with a button; the ungrouped list pages when its trailing loader scrolls into view. */
export const ListGroupLoadMore = observer(function ListGroupLoadMore(props: Props) {
  const { groupId, groupBy, containerRef, loadMoreIssues } = props;
  const { t } = useTranslation();
  const {
    issues: { getIssueLoader },
  } = useIssuesStore();
  const [intersectionElement, setIntersectionElement] = useState<HTMLDivElement | null>(null);

  const isPaginating = !!getIssueLoader(groupId);

  useIntersectionObserver(containerRef, isPaginating ? null : intersectionElement, loadMoreIssues, `100% 0% 100% 0%`);

  if (!groupBy)
    return (
      <>
        <ListLoaderItemRow />
        <ListLoaderItemRow />
        <ListLoaderItemRow ref={setIntersectionElement} />
      </>
    );

  if (isPaginating) return <ListLoaderItemRow />;

  return (
    <button
      type="button"
      className={
        "relative flex h-11 w-full cursor-pointer items-center gap-3 border border-transparent border-t-subtle-1 bg-surface-1 p-3 pl-8 text-left text-13 font-medium text-accent-primary hover:text-accent-secondary hover:underline"
      }
      onClick={() => loadMoreIssues(groupId)}
    >
      {t("common.load_more")} &darr;
    </button>
  );
});
