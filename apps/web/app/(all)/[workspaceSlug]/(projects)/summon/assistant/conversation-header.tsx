/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonAssistantMessage } from "@plane/types";

export function AssistantConversationHeader(props: {
  title: string | undefined;
  providerMessage: ISummonAssistantMessage | undefined;
}) {
  const { providerMessage } = props;
  return (
    <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-primary">{props.title ?? "New conversation"}</h2>
        <p className="truncate text-12 text-secondary">
          {providerMessage
            ? `${providerMessage.provider || "Provider unavailable"}${providerMessage.model ? ` · ${providerMessage.model}` : ""}`
            : "Answers use the sources you can access"}
        </p>
      </div>
      {providerMessage ? (
        <span className="rounded-full bg-layer-1 px-2.5 py-1 text-12 font-medium text-secondary">
          {providerMessage.provider === "deterministic" ? "Degraded mode" : providerMessage.status}
        </span>
      ) : null}
    </header>
  );
}
