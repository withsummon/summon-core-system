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
import { redirectToSignIn } from "@/services/api.service";
import { streamFailure, type TStreamFailure } from "./assistant-model";

type TStreamBody = Omit<ChatRequest, "content"> & { workspaceSlug: string; conversationId: string };

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
        // The workspace and conversation come with each turn, so the transport never holds a stale one.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const { workspaceSlug: slug, conversationId, ...rest } = body as TStreamBody;
          const content = messages.at(-1)?.parts.find((part) => part.type === "text")?.text ?? "";
          const request: ChatRequest = { content, ...rest };
          return { api: `${AI_BASE_URL}${chatPath(slug, conversationId)}`, body: request };
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
      // Like every other API call: an expired session goes back to sign-in.
      if (turn.current.failure.error_code === "unauthenticated") redirectToSignIn();
    },
  });
  const last = chat.messages.at(-1);
  const streaming = chat.status === "submitted" || chat.status === "streaming";

  /** Runs one turn to its end. The stream itself never throws; a failure comes back in the outcome. */
  const send = async (conversationId: string, payload: ISummonAssistantMessageRequest) => {
    turn.current = { truncated: false };
    const body: TStreamBody = {
      workspaceSlug,
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
