"use node";
import { createHash } from "node:crypto";
import { ConvexError } from "convex/values";
export function tokenDigest(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ConvexError("Invitation token is invalid.");
  return createHash("sha256").update(token).digest("hex");
}
