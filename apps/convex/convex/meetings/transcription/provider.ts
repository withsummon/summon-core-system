"use node";
import { z } from "zod";
import type { Doc } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { convertGeneratedText } from "../../lib/documentConversion";

import { TRANSCRIPTION_UPLOAD_TIMEOUT_MS } from "./schema";
const providerConfig = z.object({
  origin: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    }),
  key: z.string().min(16),
});
const providerResult = z.discriminatedUnion("status", [
  z.object({ id: z.string(), status: z.literal("queued"), error: z.null() }),
  z.object({ id: z.string(), status: z.literal("running"), error: z.null() }),
  z.object({
    id: z.string(),
    status: z.literal("completed"),
    error: z.null(),
    text: z.string().trim().min(1).max(120000),
    language: z.string().max(100),
  }),
  z.object({ id: z.string(), status: z.literal("failed"), error: z.string() }),
  z.object({ id: z.string(), status: z.literal("cancelled"), error: z.string().nullable() }),
]);

async function readResult(response: Response) {
  if (!response.body) throw new ConvexError("Invalid transcription response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- Bound the external response while consuming its stream sequentially.
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new ConvexError("Invalid transcription response.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return providerResult.parse(payload);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError || error instanceof z.ZodError)
      throw new ConvexError("Invalid transcription response.");
    throw error;
  }
}
const configuration = () =>
  providerConfig.safeParse({ origin: process.env.TRANSCRIPTION_ORIGIN, key: process.env.TRANSCRIPTION_API_KEY });

// This streaming transfer owns both HTTP bodies and keeps recording bytes out of the Node heap.
async function uploadRecording(
  storageUrl: string,
  url: URL,
  headers: { Authorization: string },
  asset: Pick<Doc<"assets">, "contentType" | "size" | "sha256">
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSCRIPTION_UPLOAD_TIMEOUT_MS);
  try {
    const recording = await fetch(storageUrl, { redirect: "error", signal: controller.signal });
    if (!recording.ok || !recording.body) {
      await recording.body?.cancel();
      throw new Error("Recording download failed.");
    }
    const request = {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": asset.contentType,
        "Content-Length": String(asset.size),
        "X-Content-SHA256": asset.sha256,
      },
      body: recording.body,
      duplex: "half",
      redirect: "error",
      signal: controller.signal,
    } as const;
    const uploaded = await fetch(url, request);
    await uploaded.body?.cancel();
    return uploaded.status;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

const permanentFailure = new Map([
  [400, "transcription_failed" as const],
  [401, "provider_unconfigured" as const],
  [409, "transcription_failed" as const],
  [413, "transcription_failed" as const],
  [422, "transcription_failed" as const],
  [503, "provider_unconfigured" as const],
]);
// The provider owns the HTTP protocol; callers own domain authorization and durable state.
export async function transcribe(
  jobId: string,
  asset: Pick<Doc<"assets">, "contentType" | "size" | "sha256">,
  storageUrl: () => Promise<string | null>
) {
  const config = configuration();
  if (!config.success) return { status: "unavailable" as const, error: "provider_unconfigured" as const };
  const url = new URL(`/jobs/${jobId}`, config.data.origin);
  const headers = { Authorization: `Bearer ${config.data.key}` };
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(45000) });
  if (response.status === 404) {
    await response.body?.cancel();
    const source = await storageUrl();
    if (!source) throw new Error("Recording bytes are unavailable.");
    const status = await uploadRecording(source, url, headers, asset);
    const error = permanentFailure.get(status);
    if (error) return { status: "unavailable" as const, error };
    if (![200, 202, 429].includes(status)) throw new Error("Transcription upload is unavailable.");
    return { status: "pending" as const };
  }
  if (!response.ok) {
    await response.body?.cancel();
    const error = permanentFailure.get(response.status);
    if (error) return { status: "unavailable" as const, error };
    if (response.status === 429) return { status: "pending" as const };
    throw new Error("Transcription provider is unavailable.");
  }
  try {
    const result = await readResult(response);
    if (result.id !== jobId) throw new ConvexError("Invalid transcription response.");
    return result;
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return { status: "unavailable" as const, error: "invalid_transcript" as const };
  }
}
export const step = internalAction({
  args: { runId: v.id("meetingTranscriptionRuns"), attempt: v.number() },
  handler: async (ctx, args) => {
    const prepared = await ctx.runQuery(internal.meetings.transcription.runs.prepare, args);
    if (!prepared) return;
    const result = await transcribe(args.runId, prepared.asset, () => ctx.storage.getUrl(prepared.asset.storageId));
    if (result.status === "completed")
      await ctx.runMutation(internal.meetings.transcription.runs.complete, {
        ...args,
        transcript: result.text,
        language: result.language,
        ...convertGeneratedText(result.text, prepared.document.title, prepared.document.binary),
      });
    else if (result.status === "unavailable")
      await ctx.runMutation(internal.meetings.transcription.runs.fail, { ...args, error: result.error });
    else if (result.status === "failed" || result.status === "cancelled")
      await ctx.runMutation(internal.meetings.transcription.runs.fail, { ...args, error: "transcription_failed" });
    else await ctx.runMutation(internal.meetings.transcription.runs.poll, args);
  },
});

export const cancel = internalAction({
  args: { runId: v.union(v.id("meetingTranscriptionRuns"), v.id("assistantAttachments")) },
  handler: async (_ctx, { runId }) => {
    const config = configuration();
    if (!config.success) return;
    const response = await fetch(new URL(`/jobs/${runId}`, config.data.origin), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.data.key}` },
      redirect: "error",
      signal: AbortSignal.timeout(45000),
    });
    await response.body?.cancel();
    if (!response.ok && response.status !== 404) throw new Error("Transcription cancellation is unavailable.");
    // Sidecar retention is the cleanup owner when this best-effort cancellation cannot reach it.
  },
});
