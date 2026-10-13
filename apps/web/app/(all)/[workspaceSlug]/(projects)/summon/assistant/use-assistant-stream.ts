/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AI_BASE_URL } from "@plane/constants";
import type { ChatRequest, SummonUIMessage } from "@plane/summon-contract/chat";
import { chatPath } from "@plane/summon-contract/chat-route";
import type { ISummonAssistantMessageRequest } from "@plane/types";

type TStreamBody = Omit<ChatRequest, "id" | "text"> & { conversationId: string };

/** Why a streamed turn ended badly: refused before it started (nothing saved), or failed while answering. */
export type TStreamFailure = { kind: "refused" | "answered"; error_code: string };

type TStreamOutcome = { failure?: TStreamFailure; truncated: boolean };

/**
 * Streams chat turns through the AI service (`apps/ai`). Django saves both messages as the turn runs,
 * so once a turn ends the page reloads its saved messages and the streamed copy is dropped.
 */
export function useAssistantStream(workspaceSlug: string) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport<SummonUIMessage>({
        credentials: "include",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const { conversationId, ...rest } = body as TStreamBody;
          const message = messages.at(-1);
          const text = message?.parts.find((part) => part.type === "text")?.text ?? "";
          const request: ChatRequest = { id: message?.id ?? "", text, ...rest };
          return { api: `${AI_BASE_URL}${chatPath(workspaceSlug, conversationId)}`, body: request };
        },
      })
  );
  const turn = useRef<TStreamOutcome>({ truncated: false });
  const chat = useChat<SummonUIMessage>({
    transport,
    onData: (part) => {
      if (part.type === "data-citations") turn.current.truncated = part.data.truncated;
    },
    onError: (error) => {
      turn.current.failure = streamFailure(error);
    },
  });
  const last = chat.messages.at(-1);
  const streaming = chat.status === "submitted" || chat.status === "streaming";

  /** Runs one turn to its end. The stream itself never throws; a failure comes back in the outcome. */
  const send = async (conversationId: string, payload: ISummonAssistantMessageRequest) => {
    turn.current = { truncated: false };
    const body: TStreamBody = {
      conversationId,
      context: payload.context,
      ...(payload.attachment_ids?.length ? { attachment_ids: payload.attachment_ids } : {}),
    };
    await chat.sendMessage({ text: payload.content }, { body });
    return turn.current;
  };

  return {
    /** The reply being streamed, until the page swaps in Django's saved copy. */
    reply: streaming && last?.role === "assistant" ? last : undefined,
    send,
    clear: () => chat.setMessages([]),
  };
}

/**
 * A refused request carries the AI service's JSON body (`{"error_code": …}`); an error part from a
 * running turn carries just the code, and Django has already saved that failed reply.
 */
export function streamFailure(error: Error): TStreamFailure {
  try {
    const parsed = JSON.parse(error.message) as { error_code?: unknown };
    if (typeof parsed.error_code === "string") return { kind: "refused", error_code: parsed.error_code };
  } catch {
    // Not JSON: the code from an error part.
  }
  return { kind: "answered", error_code: error.message };
}
