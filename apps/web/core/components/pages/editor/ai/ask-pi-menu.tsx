/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { CircleArrowUp, Sparkles } from "lucide-react";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
// local imports
import { AIResponseBlock } from "./response-block";

type Props = {
  handleInsertText: (insertOnNextLine: boolean) => void;
  handleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  response: string | undefined;
  workspaceSlug: string;
};

export function AskPiMenu(props: Props) {
  const { handleInsertText, handleRegenerate, isRegenerating, response, workspaceSlug } = props;
  // states
  const [query, setQuery] = useState("");
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";

  return (
    <>
      <AIResponseBlock
        response={response}
        pendingText="AI is answering…"
        handleInsertText={handleInsertText}
        handleRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
      />
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-subtle p-2 focus-within:border-accent-strong">
          <span className="grid size-3 flex-shrink-0 place-items-center">
            <Sparkles className="size-3 text-secondary" />
          </span>
          <input
            type="text"
            className="w-full border-none bg-transparent text-13 outline-none placeholder:text-placeholder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tell AI what to do"
            placeholder="Tell AI what to do…"
          />
          <span className="grid size-4 flex-shrink-0 place-items-center">
            <CircleArrowUp className="size-4 text-secondary" />
          </span>
        </div>
      </div>
    </>
  );
}
