/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { MoveRight } from "lucide-react";
import { CustomSelect } from "@plane/ui";
// ui
import { LinkIcon, CenterPanelIcon, FullScreenPanelIcon, SidePanelIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// helpers
import { copyTextToClipboard } from "@/helpers/string.helper";
// hooks
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import useClipboardWritePermission from "@/hooks/use-clipboard-write-permission";
// types
import type { IIssue, IPeekMode } from "@/types/issue";

type Props = {
  handleClose: () => void;
  issueDetails: IIssue | undefined;
};

const PEEK_MODES: {
  key: IPeekMode;
  icon: any;
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

export const PeekOverviewHeader = observer(function PeekOverviewHeader(props: Props) {
  const { handleClose } = props;

  const { peekMode, setPeekMode } = useIssueDetails();
  const isClipboardWriteAllowed = useClipboardWritePermission();

  const handleCopyLink = () => {
    const urlToCopy = window.location.href;

    copyTextToClipboard(urlToCopy).then(() => {
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Link copied!",
        message: "Work item link copied to clipboard.",
      });
    });
  };

  const Icon = PEEK_MODES.find((m) => m.key === peekMode)?.icon ?? SidePanelIcon;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {peekMode === "side" && (
          <button type="button" onClick={handleClose} className="text-tertiary hover:text-secondary">
            <MoveRight className="size-4" />
          </button>
        )}
        <CustomSelect
          value={peekMode}
          onChange={(value: IPeekMode) => setPeekMode(value)}
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
          tabIndex={1}
        >
          <LinkIcon className="h-4 w-4 -rotate-45" />
        </button>
      )}
    </div>
  );
});
