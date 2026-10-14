/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useRef } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { IWorkspaceSearchResults } from "@plane/types";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// helpers
import { PowerKModalCommandItem } from "./command-item";
import { POWER_K_SEARCH_RESULTS_GROUPS_MAP } from "./search-results-map";

/**
 * Marks items the server already matched and ranked (fuzzy, multi-word, references), so the palette's
 * substring filter keeps them in server order instead of hiding them.
 */
export const POWER_K_SEARCH_RESULT_VALUE_PREFIX = "search-result:";

const ROW_MOVE = { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const ROW_ENTER = { duration: 140, easing: "ease-out" };

/**
 * FLIP for result rows: a row that stays glides from where it was drawn to its new slot and a new row
 * fades in, so results that change on every keystroke read as movement instead of a jump. Rows are
 * keyed by cmdk's `data-value`, which carries the item id.
 */
function useResultRowMotion(container: React.RefObject<HTMLDivElement | null>, results: IWorkspaceSearchResults) {
  const layoutTops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const previous = layoutTops.current;
    const next = new Map<string, number>();
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rootTop = root.getBoundingClientRect().top;

    for (const row of root.querySelectorAll<HTMLElement>("[cmdk-item][data-value]")) {
      const id = row.dataset.value!;
      const layoutTop = row.offsetTop;
      next.set(id, layoutTop);
      if (!animate) continue;
      const before = previous.get(id);
      if (before === undefined) {
        row.animate([{ opacity: 0 }, { opacity: 1 }], ROW_ENTER);
        continue;
      }
      // Unmoved rows keep any glide in flight; re-renders without a layout change must not restart it.
      if (before === layoutTop) continue;
      // Include any glide still in flight so an interrupted row continues from where it is drawn.
      const inFlight = row.getBoundingClientRect().top - rootTop - layoutTop;
      const delta = before + inFlight - layoutTop;
      for (const running of row.getAnimations()) running.cancel();
      if (Math.abs(delta) >= 1) {
        row.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], ROW_MOVE);
      }
    }
    layoutTops.current = next;
  }, [container, results]);
}

type Props = {
  closePalette: () => void;
  results: IWorkspaceSearchResults;
};

export const PowerKModalSearchResults = observer(function PowerKModalSearchResults(props: Props) {
  const { closePalette, results } = props;
  // router
  const router = useAppRouter();
  const { projectId: routerProjectId } = useParams();
  // derived values
  const projectId = routerProjectId?.toString();
  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  useResultRowMotion(containerRef, results);

  return (
    <div ref={containerRef} className="relative">
      {Object.keys(results.results).map((key) => {
        const section = results.results[key as keyof typeof results.results];
        const currentSection = POWER_K_SEARCH_RESULTS_GROUPS_MAP[key as keyof typeof POWER_K_SEARCH_RESULTS_GROUPS_MAP];

        if (!currentSection) return null;
        if (section.length <= 0) return null;

        return (
          <Command.Group key={key} heading={currentSection.title}>
            {section.map((item) => {
              let value = `${POWER_K_SEARCH_RESULT_VALUE_PREFIX}${key}-${item?.id}-${item.name}`;

              if ("project__identifier" in item) {
                value = `${value}-${item.project__identifier}`;
              }

              if ("sequence_id" in item) {
                value = `${value}-${item.sequence_id}`;
              }

              return (
                <PowerKModalCommandItem
                  key={item.id}
                  label={currentSection.itemName(item)}
                  icon={currentSection.icon}
                  onSelect={() => {
                    closePalette();
                    router.push(currentSection.path(item, projectId));
                    // const itemProjectId =
                    //   item?.project_id ||
                    //   (Array.isArray(item?.project_ids) && item?.project_ids?.length > 0
                    //     ? item?.project_ids[0]
                    //     : undefined);
                    // if (itemProjectId) openProjectAndScrollToSidebar(itemProjectId);
                  }}
                  value={value}
                />
              );
            })}
          </Command.Group>
        );
      })}
    </div>
  );
});
