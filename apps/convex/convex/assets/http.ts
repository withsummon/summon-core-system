import { isAudioAsset } from "./content";
import { ConvexError } from "convex/values";
import { httpAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { recordingReadMaxBytes } from "./content";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Range",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
export const options = httpAction(async () => new Response(null, { status: 204, headers: cors }));
export const read = httpAction(async (ctx, request) => {
  if (!(await ctx.runQuery(api.identity.session.status, {})).valid)
    return new Response("Authentication required.", { status: 401, headers: cors });
  try {
    const url = new URL(request.url);
    const workspace = url.searchParams.get("workspace");
    const asset = await ctx.runQuery(internal.assets.index.download, {
      assetId: url.pathname.slice("/assets/".length),
      ...(workspace ? { readWorkspaceId: workspace } : {}),
    });
    if (!asset.storageId) return new Response("Asset not found.", { status: 404, headers: cors });
    const headers = {
      ...cors,
      "Content-Type": asset.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    };
    if (isAudioAsset(asset)) return readRecordingRange(ctx, request, asset.storageId, asset.size, headers);
    const body = await ctx.storage.get(asset.storageId);
    if (!body) return new Response("Asset not found.", { status: 404, headers: cors });
    return new Response(body, { headers });
  } catch (error) {
    if (error instanceof ConvexError) return new Response("Asset access denied.", { status: 403, headers: cors });
    throw error;
  }
});

// This private range protocol stays below the HTTP action response limit without exposing storage URLs.
async function readRecordingRange(
  ctx: ActionCtx,
  request: Request,
  storageId: Id<"_storage">,
  size: number,
  headers: Record<string, string>
) {
  const requested = request.headers.get("range") ?? "";
  const range = /^bytes=(\d+)-(\d+)$/.exec(requested);
  const start = Number(range?.[1]);
  const requestedEnd = Number(range?.[2]);
  const end = Math.min(requestedEnd, size - 1);
  if (
    !range ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    end < start ||
    start >= size ||
    end - start + 1 > recordingReadMaxBytes
  )
    return new Response(null, { status: 416, headers: { ...cors, "Content-Range": `bytes */${size}` } });
  const storageUrl = await ctx.storage.getUrl(storageId);
  if (!storageUrl) return new Response("Asset not found.", { status: 404, headers: cors });
  const response = await fetch(storageUrl, { headers: { Range: `bytes=${start}-${end}` }, redirect: "error" });
  const contentRange = `bytes ${start}-${end}/${size}`;
  if (
    response.status !== 206 ||
    response.headers.get("content-range") !== contentRange ||
    response.headers.get("content-length") !== String(end - start + 1)
  ) {
    await response.body?.cancel();
    return new Response("Recording range is unavailable.", { status: 502, headers: cors });
  }
  if (!response.body) return new Response("Asset not found.", { status: 404, headers: cors });
  return new Response(response.body, {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": contentRange,
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
    },
  });
}
