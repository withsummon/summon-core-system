import { ConvexError, compareValues } from "convex/values";
import { z } from "zod/v4";
import { zodToConvex, zodToConvexFields } from "convex-helpers/server/zod4";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireInstanceAdmin } from "./access";
import { requireUser } from "../session";
import { encrypt, decrypt } from "../../mcp/crypto";

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
const photoId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const listInput = z.object({ search: z.string().trim().max(255) });
const publicUrl = z
  .url({ protocol: /^https$/ })
  .max(8192)
  .refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.port;
  });
const imageUrl = publicUrl.refine((value) => new URL(value).hostname === "images.unsplash.com");
const attributionUrl = publicUrl.refine((value) => new URL(value).hostname === "unsplash.com");
const photo = z.object({
  id: photoId,
  alt_description: z.string().max(4096).nullable(),
  urls: z.object({ small: imageUrl, regular: imageUrl }),
  links: z.object({ html: attributionUrl }),
  user: z.object({ name: z.string().max(255), links: z.object({ html: attributionUrl }) }),
});
const selectionPhoto = photo.extend({
  links: photo.shape.links.extend({
    download_location: publicUrl.refine((value) => new URL(value).hostname === "api.unsplash.com"),
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
// Only authenticated actions receive the decrypted credential. Initialized missing config never falls back to env.
export const stockConfiguration = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const instance = await imageInstance(ctx);
    if (!imageForInstance(instance).configured) throw new ConvexError("Unsplash is not configured.");
    const apiKey = instance?.unsplashKey
      ? await decrypt(instance.unsplashKey)
      : unsplashKey.parse(process.env.UNSPLASH_ACCESS_KEY);
    return {
      userId: user._id,
      revision: instance?.revision ?? null,
      apiKey: unsplashKey.parse(apiKey),
    };
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
  returns: zodToConvex(z.array(photo).max(20)),
  handler: async (ctx, input): Promise<z.infer<typeof photo>[]> => {
    const args = listInput.parse(input);
    const configuration = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    const url = new URL(args.search ? "/search/photos" : "/photos", "https://api.unsplash.com");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "20");
    if (args.search) url.searchParams.set("query", args.search);
    let photos: z.infer<typeof photo>[];
    try {
      const response = await providerResponse(url, configuration.apiKey);
      photos = args.search
        ? z.object({ results: z.array(photo).max(20) }).parse(response).results
        : z.array(photo).max(20).parse(response);
    } catch {
      throw new ConvexError("Unsplash images could not be loaded. Try again.");
    }
    const current = await ctx.runQuery(internal.identity.instance.image.stockConfiguration, {});
    if (compareValues(configuration, current) !== 0)
      throw new ConvexError("Image configuration changed. Search again.");
    return photos;
  },
});
export const select = action({
  args: { photoId: zodToConvex(photoId) },
  returns: zodToConvex(photo),
  handler: async (ctx, input): Promise<z.infer<typeof photo>> => {
    const id = photoId.parse(input.photoId);
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
    return photo.parse(selected);
  },
});
