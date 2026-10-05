import { ConvexError, compareValues, v } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex, zodToConvexFields } from "convex-helpers/server/zod4";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireInstanceAdmin } from "./access";
import { requireUser } from "../session";
import { encrypt, decrypt } from "../../mcp/crypto";
import { publicStockUrl, stockPhoto, stockPhotoId, withStockAttribution } from "../../assets/content";

const revision = z.int().nonnegative();
const unsplashKey = z
  .string()
  .trim()
  .min(1)
  .max(8192)
  .regex(/^[A-Za-z0-9_-]+$/);
const saveInput = z.object({
  expectedRevision: revision,
  apiKey: unsplashKey.or(z.literal("")).nullable(),
});
const listInput = z.object({ search: z.string().trim().max(255) });
const selectionPhoto = stockPhoto.extend({
  links: stockPhoto.shape.links.extend({
    download_location: publicStockUrl.refine((value) => new URL(value).hostname === "api.unsplash.com"),
  }),
});
const trackingAcceptance = z.object({ url: z.url({ protocol: /^https$/ }).max(8192) });
async function imageInstance(ctx: QueryCtx) {
  return ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
}
export function imageForInstance(instance: Doc<"instanceAuthority"> | null) {
  if (!instance)
    return {
      configured: unsplashKey.safeParse(process.env.UNSPLASH_ACCESS_KEY).success,
      adoptionRequired: false,
    };
  return {
    configured: instance.unsplashKey != null,
    adoptionRequired: instance.unsplashKey === undefined,
  };
}
export async function operatorUnsplashKey(env: Record<string, string | undefined>) {
  if (!env.UNSPLASH_ACCESS_KEY) return null;
  return encrypt(unsplashKey.parse(env.UNSPLASH_ACCESS_KEY));
}
export const get = query({
  args: {},
  handler: async (ctx) => {
    const { instance } = await requireInstanceAdmin(ctx);
    return {
      ...imageForInstance(instance),
      credentialPresent: instance.unsplashKey != null,
      revision: instance.revision,
    };
  },
});
export const save = mutation({
  args: zodToConvexFields(saveInput.shape),
  handler: async (ctx, input) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const args = saveInput.parse(input);
    if (instance.revision !== args.expectedRevision)
      throw new ConvexError("Instance settings changed. Review the latest settings before saving.");
    if (instance.unsplashKey === undefined)
      throw new ConvexError("Image configuration requires explicit operator adoption.");
    if (args.apiKey === "" && instance.unsplashKey === null) throw new ConvexError("Enter an Unsplash access key.");
    if (args.apiKey && instance.unsplashKey && args.apiKey === (await decrypt(instance.unsplashKey)))
      return instance.revision;
    const key = args.apiKey === null ? null : args.apiKey === "" ? instance.unsplashKey : await encrypt(args.apiKey);
    if (compareValues(key, instance.unsplashKey) === 0) return instance.revision;
    const nextRevision = instance.revision + 1;
    await ctx.db.patch(instance._id, { unsplashKey: key, revision: nextRevision });
    return nextRevision;
  },
});
// Require this field and retire adoption after both hosts prove complete coverage and second-pass zero.
export const adopt = internalMutation({
  args: { expectedRevision: zodToConvex(revision) },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    if (instance.revision !== revision.parse(args.expectedRevision))
      throw new ConvexError("Instance settings changed. Review the latest settings before adoption.");
    if (instance.unsplashKey !== undefined) return { changed: 0, revision: instance.revision };
    const key = await operatorUnsplashKey(process.env);
    const nextRevision = instance.revision + 1;
    await ctx.db.patch(instance._id, { unsplashKey: key, revision: nextRevision });
    return { changed: 1, revision: nextRevision };
  },
});
export const availability = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const instance = await imageInstance(ctx);
    return { ...imageForInstance(instance), revision: instance?.revision ?? null };
  },
});
const stockConfigurationFields = {
  userId: v.id("users"),
  revision: v.union(zodToConvex(revision), v.null()),
  apiKey: zodToConvex(unsplashKey),
};
async function currentStockConfiguration(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const instance = await imageInstance(ctx);
  if (!imageForInstance(instance).configured) throw new ConvexError("Unsplash is not configured.");
  const apiKey = instance?.unsplashKey
    ? await decrypt(instance.unsplashKey)
    : unsplashKey.parse(process.env.UNSPLASH_ACCESS_KEY);
  return { userId: user._id, revision: instance?.revision ?? null, apiKey: unsplashKey.parse(apiKey) };
}
// Internal server calls alone receive the credential; it is never stored with public photo metadata.
export const stockConfiguration = internalQuery({
  args: {},
  returns: v.object(stockConfigurationFields),
  handler: currentStockConfiguration,
});
export const recordPhoto = internalMutation({
  args: { configuration: v.object(stockConfigurationFields), photo: zodToConvex(stockPhoto) },
  returns: zodToConvex(stockPhoto),
  handler: async (ctx, args) => {
    if (compareValues(await currentStockConfiguration(ctx), args.configuration) !== 0)
      throw new ConvexError("Image configuration or account changed. Choose the image again.");
    const photo = withStockAttribution(stockPhoto.parse(args.photo));
    const existing = await ctx.db
      .query("stockPhotos")
      .withIndex("by_regular_url", (q) => q.eq("urls.regular", photo.urls.regular))
      .unique();
    if (existing) {
      if (compareValues(stockPhoto.parse(existing), photo) !== 0) await ctx.db.patch(existing._id, photo);
    } else await ctx.db.insert("stockPhotos", photo);
    return photo;
  },
});
const attributionInput = z.string().min(1).max(8192);
// These records contain public provider metadata only; arbitrary URLs never cause a provider fetch.
export const attribution = query({
  args: { url: zodToConvex(attributionInput) },
  returns: zodToConvex(stockPhoto.nullable()),
  handler: async (ctx, args) => {
    const url = attributionInput.parse(args.url);
    const existing = await ctx.db
      .query("stockPhotos")
      .withIndex("by_regular_url", (q) => q.eq("urls.regular", url))
      .unique();
    return existing ? stockPhoto.parse(existing) : null;
  },
});
async function providerResponse(url: URL, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${apiKey}`, "Accept-Version": "v1" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error("Unsplash request failed.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = "",
    bytes = 0;
  try {
    while (true) {
      // oxlint-disable-next-line no-await-in-loop -- Provider chunks are read sequentially within the byte budget.
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1_048_576) throw new Error("Unsplash response exceeded its size limit.");
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    await reader.cancel();
  }
}
export const list = action({
  args: zodToConvexFields(listInput.shape),
  returns: zodToConvex(z.array(stockPhoto).max(20)),
  handler: async (ctx, input): Promise<z.infer<typeof stockPhoto>[]> => {
    const args = listInput.parse(input);
    const configuration = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    const url = new URL(args.search ? "/search/photos" : "/photos", "https://api.unsplash.com");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "20");
    if (args.search) url.searchParams.set("query", args.search);
    let photos: z.infer<typeof stockPhoto>[];
    try {
      const response = await providerResponse(url, configuration.apiKey);
      photos = args.search
        ? z.object({ results: z.array(stockPhoto).max(20) }).parse(response).results
        : z.array(stockPhoto).max(20).parse(response);
    } catch {
      throw new ConvexError("Unsplash images could not be loaded. Try again.");
    }
    const current = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    if (compareValues(configuration, current) !== 0)
      throw new ConvexError("Image configuration changed. Search again.");
    return photos.map(withStockAttribution);
  },
});
export const select = action({
  args: { photoId: zodToConvex(stockPhotoId) },
  returns: zodToConvex(stockPhoto),
  handler: async (ctx, input): Promise<z.infer<typeof stockPhoto>> => {
    const id = stockPhotoId.parse(input.photoId);
    const configuration = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    let selected: z.infer<typeof selectionPhoto>;
    try {
      selected = selectionPhoto.parse(
        await providerResponse(new URL(`/photos/${id}`, "https://api.unsplash.com"), configuration.apiKey)
      );
    } catch {
      throw new ConvexError("This Unsplash image could not be loaded. Choose it again.");
    }
    const download = new URL(selected.links.download_location);
    if (selected.id !== id || download.pathname !== `/photos/${id}/download`)
      throw new ConvexError("This Unsplash image is unavailable.");
    const current = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    if (compareValues(configuration, current) !== 0)
      throw new ConvexError("Image configuration changed. Choose the image again.");
    try {
      trackingAcceptance.parse(await providerResponse(download, current.apiKey));
    } catch {
      throw new ConvexError("Unsplash selection could not be confirmed. No cover change has been submitted.");
    }
    const latest = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    if (compareValues(current, latest) !== 0)
      throw new ConvexError("Image configuration changed. Choose the image again.");
    return ctx.runMutation(internal.identity.instance.image.recordPhoto, {
      configuration: latest,
      photo: stockPhoto.parse(selected),
    });
  },
});
