/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { RefreshCw } from "lucide-react";
// types
import type { TNameDescriptionLoader } from "@plane/types";

type Props = {
  isSubmitting: TNameDescriptionLoader;
};

export function nameDescriptionStatus(
  title: TNameDescriptionLoader,
  description: TNameDescriptionLoader
): TNameDescriptionLoader {
  if (title === "failed" || description === "failed") return "failed";
  if (title === "submitting" || description === "submitting") return "submitting";
  if (title === "submitted" || description === "submitted") return "submitted";
  return "saved";
}

export const NameDescriptionUpdateStatus = observer(function NameDescriptionUpdateStatus(props: Props) {
  const { isSubmitting } = props;

  return (
    <>
      <div
        className={`flex items-center gap-x-2 transition-all duration-300 ${
          isSubmitting === "saved" ? "fade-out" : "fade-in"
        }`}
      >
        {isSubmitting === "submitting" && <RefreshCw className="size-3.5 animate-spin stroke-tertiary" />}
        <span className="text-13 text-tertiary">
          {isSubmitting === "failed" ? "Not saved" : isSubmitting === "submitting" ? "Saving..." : "Saved"}
        </span>
      </div>
    </>
  );
});
