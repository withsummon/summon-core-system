/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
// helpers
import type { TCustomComponentsMetaData } from "@plane/utils";
// helpers
import type { EditorTarget } from "@/helpers/editor.helper";
import { getEditorAssetSrc } from "@/helpers/editor.helper";
// hooks
import { useMember } from "@/hooks/store/use-member";

type TArgs = {
  target: EditorTarget;
};

export const useParseEditorContent = (args: TArgs) => {
  const { target } = args;
  // store hooks
  const { results } = useMember();

  const getEditorMetaData = useCallback(
    (htmlContent: string): TCustomComponentsMetaData => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const imageMetaData: TCustomComponentsMetaData["file_assets"] = [];
      // process image components
      const imageComponents = doc.querySelectorAll("image-component");
      imageComponents.forEach((element) => {
        const src = element.getAttribute("src");
        if (src) {
          const assetSrc = getEditorAssetSrc(target, src);
          if (assetSrc) {
            imageMetaData.push({
              id: src,
              name: src,
              url: assetSrc,
            });
          }
        }
      });
      // process user mentions
      const userMentions: TCustomComponentsMetaData["user_mentions"] = [];
      const mentionComponents = doc.querySelectorAll("mention-component");
      mentionComponents.forEach((element) => {
        const id = element.getAttribute("entity_identifier");
        if (id) {
          const userDetails = results.find((member) => member.userId === id);
          const originUrl = typeof window !== "undefined" && (window.location.origin ?? "");
          const path = `profile/${id}`;
          const url = `${originUrl}/${path}`;
          if (userDetails) {
            userMentions.push({
              id,
              display_name: userDetails.name ?? "",
              url,
            });
          }
        }
      });

      return {
        file_assets: imageMetaData,
        user_mentions: userMentions,
      };
    },
    [target, results]
  );

  return {
    getEditorMetaData,
  };
};
