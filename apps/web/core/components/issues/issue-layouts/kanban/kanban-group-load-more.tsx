/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { MutableRefObject } from "react";
import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
// components
import { KanbanIssueBlockLoader } from "@/components/ui/loader/layouts/kanban-layout-loader";
// hooks
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIssuesStore } from "@/hooks/use-issue-layout-store";

type Props = {
  groupId: string;
  subGroupId: string;
  isSubGroup: boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
};

/** Sub-grouped columns page with a button; plain columns page when their trailing loader scrolls into view. */
export const KanbanGroupLoadMore = observer(function KanbanGroupLoadMore(props: Props) {
  const { groupId, subGroupId, isSubGroup, containerRef, onLoadMore } = props;
  const { t } = useTranslation();
  const {
    issues: { getIssueLoader },
  } = useIssuesStore();
  const [intersectionElement, setIntersectionElement] = useState<HTMLSpanElement | null>(null);

  const isPaginating = !!getIssueLoader(groupId, subGroupId);

  useIntersectionObserver(containerRef, isPaginating ? null : intersectionElement, onLoadMore, `0% 100% 100% 100%`);

  if (!isSubGroup)
    return (
      <div className="flex flex-col gap-2">
        <KanbanIssueBlockLoader />
        <KanbanIssueBlockLoader />
        <KanbanIssueBlockLoader ref={setIntersectionElement} />
      </div>
    );

  if (isPaginating) return <KanbanIssueBlockLoader />;

  return (
    <button
      type="button"
      className="sticky bottom-0 w-full cursor-pointer p-3 text-left text-13 font-medium text-accent-primary hover:text-accent-secondary hover:underline"
      onClick={onLoadMore}
    >
      {t("common.load_more")} &darr;
    </button>
  );
});
