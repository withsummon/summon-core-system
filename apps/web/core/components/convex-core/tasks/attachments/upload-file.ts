import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
type Policy = FunctionReturnType<typeof api.assets.index.policy>;
export function attachmentContentType(file: Pick<File, "name" | "type" | "size">, policy: Policy) {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const contentType = file.type || Object.entries(policy.typesByExtension).find(([key]) => key === extension)?.[1];
  if (!contentType || !policy.supportedTypes.some((type) => type === contentType))
    throw new Error("Choose a supported attachment format.");
  const limit = contentType.startsWith("image/") ? policy.imageMaxBytes : policy.maxBytes;
  if (file.size < 1 || file.size > limit) throw new Error(`Choose a nonempty file up to ${limit / 1024 / 1024} MB.`);
  return contentType;
}
