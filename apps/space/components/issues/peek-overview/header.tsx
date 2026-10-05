/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { MoveRight, X } from "lucide-react";
import { CustomSelect } from "@plane/ui";
// ui
import { LinkIcon, CenterPanelIcon, FullScreenPanelIcon, SidePanelIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// helpers
import { copyTextToClipboard } from "@/helpers/string.helper";
// hooks

import useClipboardWritePermission from "@/hooks/use-clipboard-write-permission";
// types

type Props = {
  handleClose: () => void;
  peekMode: "side" | "modal" | "full";
  setPeekMode: (mode: Props["peekMode"]) => void;
};

const PEEK_MODES: {
  key: Props["peekMode"];
  icon: typeof SidePanelIcon;
  label: string;
}[] = [
  { key: "side", icon: SidePanelIcon, label: "Side Peek" },
  {
    key: "modal",
    icon: CenterPanelIcon,
    label: "Modal",
  },
  {
    key: "full",
    icon: FullScreenPanelIcon,
    label: "Full Screen",
  },
];

export function PeekOverviewHeader(props: Props) {
  const { handleClose, peekMode, setPeekMode } = props;
  const isClipboardWriteAllowed = useClipboardWritePermission();

  const handleCopyLink = async () => {
    try {
      await copyTextToClipboard(window.location.href);
      setToast({ type: TOAST_TYPE.SUCCESS, title: "Link copied!", message: "Work item link copied to clipboard." });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Link could not be copied",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const Icon = PEEK_MODES.find((m) => m.key === peekMode)?.icon ?? SidePanelIcon;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close work item details"
          className="text-tertiary hover:text-secondary"
        >
          {peekMode === "side" ? <MoveRight className="size-4" /> : <X className="size-4" />}
        </button>
        <CustomSelect
          value={peekMode}
          onChange={(value: Props["peekMode"]) => setPeekMode(value)}
          customButton={<Icon className="size-4" aria-label="Work item view" />}
          customButtonClassName="grid place-items-center text-tertiary hover:text-secondary"
          noChevron
        >
          {PEEK_MODES.map((mode) => (
            <CustomSelect.Option key={mode.key} value={mode.key}>
              <span className="flex items-center gap-1.5">
                <mode.icon className="size-4" />
                {mode.label}
              </span>
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      </div>
      {isClipboardWriteAllowed && (peekMode === "side" || peekMode === "modal") && (
        <button
          type="button"
          onClick={handleCopyLink}
          className="shrink-0 text-tertiary hover:text-secondary focus:outline-none"
          aria-label="Copy work item link"
        >
          <LinkIcon className="h-4 w-4 -rotate-45" />
        </button>
      )}
    </div>
  );
}
