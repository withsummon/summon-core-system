/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import type { TNameDescriptionLoader } from "@plane/types";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

/** Warns before reload while a name/description save is in flight, and settles "submitted" back to "saved". */
export const useSubmitStatusAlert = (
  isSubmitting: TNameDescriptionLoader,
  setIsSubmitting: (value: TNameDescriptionLoader) => void
) => {
  const { setShowAlert } = useReloadConfirmations(isSubmitting === "submitting");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isSubmitting === "submitted") {
      setShowAlert(false);
      timer = setTimeout(() => setIsSubmitting("saved"), 2000);
    } else if (isSubmitting === "submitting") {
      setShowAlert(true);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting, setShowAlert, setIsSubmitting]);
};
