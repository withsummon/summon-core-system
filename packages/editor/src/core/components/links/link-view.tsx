/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Editor } from "@tiptap/react";
import type { CSSProperties } from "react";
import { useState } from "react";
// components
import { LinkEditView, LinkPreview } from "@/components/links";

export type LinkViews = "LinkPreview" | "LinkEditView";

export type LinkViewProps = {
  view?: LinkViews;
  editor: Editor;
  from: number;
  to: number;
  url: string;
  text?: string;
  closeLinkView: () => void;
};

type Props = LinkViewProps & { style: CSSProperties };

export function LinkView(props: Props) {
  // Remount on a new link position so the view resets to the preview.
  return <LinkViewContent key={props.from} {...props} />;
}

function LinkViewContent(props: Props) {
  const [currentView, setCurrentView] = useState<LinkViews>(props.view ?? "LinkPreview");

  const switchView = (view: LinkViews) => {
    setCurrentView(view);
  };

  return (
    <>
      {currentView === "LinkPreview" && <LinkPreview viewProps={props} switchView={switchView} />}
      {currentView === "LinkEditView" && <LinkEditView viewProps={props} switchView={switchView} />}
    </>
  );
}
