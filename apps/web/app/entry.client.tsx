/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import polyfills from "@/lib/polyfills";

void polyfills;

document.querySelectorAll("body > script").forEach((script) => {
  if (script.textContent?.includes("/cdn-cgi/challenge-platform/")) script.remove();
});
document
  .querySelectorAll('body > iframe[height="1"][width="1"][style*="visibility: hidden"]')
  .forEach((iframe) => iframe.remove());

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
