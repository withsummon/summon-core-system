/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { StickyNote as StickyIcon } from "lucide-react";
// plane hooks
import { useOutsideClickDetector } from "@plane/hooks";
// plane ui
import { RecentStickyIcon, StickyNoteIcon, PlusIcon, CloseIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
// plane utils
import { cn } from "@plane/utils";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useSticky } from "@/hooks/use-stickies";
// components
import { STICKY_COLORS_LIST } from "../editor/sticky-editor/color-palette";
import { AllStickiesModal } from "./modal";
import { StickyNote } from "./sticky";

type TRecentStickyButtonProps = {
  workspaceSlug: string;
  recentStickyId: string;
  previewStickyId: string | undefined;
  isDisabled: boolean;
  onOpen: () => void;
};

const RecentStickyButton = observer(function RecentStickyButton(props: TRecentStickyButtonProps) {
  const { workspaceSlug, recentStickyId, previewStickyId, isDisabled, onOpen } = props;
  // store hooks
  const { stickies } = useSticky();
  // derived values
  const recentStickyBackgroundColor = STICKY_COLORS_LIST.find(
    (c) => c.key === stickies[recentStickyId].background_color
  )?.backgroundColor;

  return (
    <Tooltip
      className="-mr-30 translate-x-10 scale-75"
      tooltipContent={
        <div className="-m-2 max-h-[150px]">
          <StickyNote className={"w-[290px]"} workspaceSlug={workspaceSlug} stickyId={previewStickyId} />
          <div
            className="pointer-events-none absolute top-0 right-0 h-full w-full"
            style={{
              background: `linear-gradient(to top, ${recentStickyBackgroundColor}, transparent)`,
            }}
          />
        </div>
      }
      isMobile={false}
      position="left"
      disabled={isDisabled}
    >
      <button
        type="button"
        aria-label="Open recent sticky"
        className="btn btn--icon flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 shadow-sm"
        onClick={onOpen}
        style={{ color: recentStickyBackgroundColor }}
      >
        <StickyNoteIcon className={cn("size-5 rotate-90")} color={recentStickyBackgroundColor} />
      </button>
    </Tooltip>
  );
});

function StickiesMenuToggle({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={isExpanded ? "Close stickies menu" : "Open stickies menu"}
      aria-expanded={isExpanded}
      className={`btn btn--icon flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 shadow-sm transition-[rotate] duration-300 ${isExpanded ? "rotate-180" : ""}`}
      onClick={onToggle}
    >
      {isExpanded ? (
        <CloseIcon className="size-5 text-tertiary" />
      ) : (
        <StickyIcon className="size-5 rotate-90 text-tertiary" />
      )}
    </button>
  );
}

export const StickyActionBar = observer(function StickyActionBar() {
  // states
  const [isExpanded, setIsExpanded] = useState(false);
  const [newSticky, setNewSticky] = useState(false);
  const [showRecentSticky, setShowRecentSticky] = useState(false);
  // navigation
  const { workspaceSlug } = useParams();
  // refs
  const ref = useRef(null);
  // store hooks
  const { activeStickyId, recentStickyId, updateActiveStickyId, fetchRecentSticky, toggleShowNewSticky } = useSticky();
  const { toggleAllStickiesModal, allStickiesModal } = useCommandPalette();
  useSWR(
    workspaceSlug ? `WORKSPACE_STICKIES_RECENT_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchRecentSticky(workspaceSlug.toString()) : null
  );

  useOutsideClickDetector(ref, () => {
    setNewSticky(false);
    setShowRecentSticky(false);
    setIsExpanded(false);
  });

  return (
    <div
      ref={ref}
      className="sticky-action-bar__item flex flex-col overflow-hidden rounded-full border-2 border-accent-strong/10 bg-surface-2 p-[2px]"
    >
      <div
        className={`flex origin-bottom flex-col gap-2 transition-[scale,opacity,margin-bottom,height] duration-300 ease-in-out ${isExpanded ? "mb-2 scale-y-100 opacity-100 " : "h-0 scale-y-0 opacity-0"}`}
      >
        <Tooltip tooltipContent="All stickies" isMobile={false} position="left">
          <button
            type="button"
            aria-label="All stickies"
            className="btn btn--icon flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 shadow-sm"
            onClick={() => toggleAllStickiesModal(true)}
          >
            <RecentStickyIcon className="size-5 rotate-90 text-tertiary" />
          </button>
        </Tooltip>
        {recentStickyId && (
          <RecentStickyButton
            workspaceSlug={workspaceSlug.toString()}
            recentStickyId={recentStickyId}
            previewStickyId={newSticky ? activeStickyId : recentStickyId || ""}
            isDisabled={showRecentSticky}
            onOpen={() => setShowRecentSticky(true)}
          />
        )}
        <Tooltip tooltipContent="Add sticky" isMobile={false} position="left">
          <button
            type="button"
            aria-label="Add sticky"
            className="btn btn--icon flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 shadow-sm"
            onClick={() => {
              updateActiveStickyId("");
              toggleShowNewSticky(true);
              setNewSticky(true);
            }}
          >
            <PlusIcon className="size-5 rotate-90 text-tertiary" />
          </button>
        </Tooltip>
      </div>

      <StickiesMenuToggle isExpanded={isExpanded} onToggle={() => setIsExpanded(!isExpanded)} />

      <div
        className={cn(
          "absolute right-0 bottom-16 z-[20]",
          "transition-[translate,height,min-height] duration-300 ease-in-out",
          newSticky || showRecentSticky ? "min-h-[300px] translate-y-[0%]" : "h-0 translate-y-[100%]"
        )}
      >
        {(newSticky || (showRecentSticky && recentStickyId)) && (
          <StickyNote
            className={"w-[290px]"}
            onClose={() => (newSticky ? setNewSticky(false) : setShowRecentSticky(false))}
            workspaceSlug={workspaceSlug.toString()}
            stickyId={newSticky ? activeStickyId : recentStickyId || ""}
          />
        )}
      </div>

      <AllStickiesModal isOpen={allStickiesModal} handleClose={() => toggleAllStickiesModal(false)} />
    </div>
  );
});
