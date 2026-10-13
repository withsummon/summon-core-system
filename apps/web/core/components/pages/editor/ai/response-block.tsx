/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { CornerDownRight, RefreshCcw, Sparkles } from "lucide-react";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// components
import { RichTextEditor } from "@/components/editor/rich-text";

type Props = {
  response: string | undefined;
  /** Shown while there is no response yet. */
  pendingText: ReactNode;
  handleInsertText: (insertOnNextLine: boolean) => void;
  handleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  workspaceId: string;
  workspaceSlug: string;
};

/** The AI response (read-only) with replace / insert / regenerate actions, or a pending message. */
export function AIResponseBlock(props: Props) {
  const { response, pendingText, handleInsertText, handleRegenerate, isRegenerating, workspaceId, workspaceSlug } =
    props;

  return (
    <div
      className={cn("flex items-center gap-3 px-4 py-3.5", {
        "items-start": response,
      })}
    >
      <span className="grid size-7 flex-shrink-0 place-items-center rounded-full border border-subtle text-secondary">
        <Sparkles className="size-3" />
      </span>
      {response ? (
        <div>
          <RichTextEditor
            editable={false}
            displayConfig={{
              fontSize: "small-font",
            }}
            id="editor-ai-response"
            initialValue={response}
            containerClassName="!p-0 border-none"
            editorClassName="!pl-0"
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              className="rounded-sm p-1 text-13 font-medium text-tertiary outline-none hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
              onClick={() => handleInsertText(false)}
            >
              Replace selection
            </button>
            <Tooltip tooltipContent="Add to next line">
              <button
                type="button"
                className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
                aria-label="Add to next line"
                onClick={() => handleInsertText(true)}
              >
                <CornerDownRight className="size-4 text-tertiary" />
              </button>
            </Tooltip>
            <Tooltip tooltipContent="Re-generate response">
              <button
                type="button"
                className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
                aria-label="Re-generate response"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRegenerate();
                }}
                disabled={isRegenerating}
              >
                <RefreshCcw
                  className={cn("size-4 text-tertiary", {
                    "animate-spin": isRegenerating,
                  })}
                />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <p className="text-13 text-secondary">{pendingText}</p>
      )}
    </div>
  );
}
