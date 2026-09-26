import { ConvexError } from "convex/values";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
export const options = httpAction(async () => new Response(null, { status: 204, headers: cors }));
export const read = httpAction(async (ctx, request) => {
  if (!(await ctx.auth.getUserIdentity()))
    return new Response("Authentication required.", { status: 401, headers: cors });
  try {
    const asset = await ctx.runQuery(internal.assets.index.download, {
      assetId: new URL(request.url).pathname.slice("/assets/".length),
    });
    const blob = asset.storageId ? await ctx.storage.get(asset.storageId) : null;
    if (!blob) return new Response("Asset not found.", { status: 404, headers: cors });
    return new Response(blob, {
      headers: {
        ...cors,
        "Content-Type": asset.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    if (error instanceof ConvexError) return new Response("Asset access denied.", { status: 403, headers: cors });
    throw error;
  }
});
