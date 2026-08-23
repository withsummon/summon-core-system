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

const removeInjectedDocumentElements = () =>
  document.documentElement
    .querySelectorAll(":scope > :not(head):not(body)")
    .forEach((injectedElement) => injectedElement.remove());

const documentObserver = new MutationObserver(removeInjectedDocumentElements);
documentObserver.observe(document.documentElement, { childList: true });

startTransition(() => {
  removeInjectedDocumentElements();
  document.querySelectorAll("body > script").forEach((script) => {
    if (script.textContent?.includes("/cdn-cgi/challenge-platform/")) script.remove();
  });
  document
    .querySelectorAll('body > iframe[height="1"][width="1"][style*="visibility: hidden"]')
    .forEach((iframe) => iframe.remove());

  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
  window.setTimeout(() => documentObserver.disconnect(), 1_000);
});
