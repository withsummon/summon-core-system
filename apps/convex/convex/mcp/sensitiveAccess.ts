import { requireWorkspace } from "../identity/access";
import { operation } from "./schema";
import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireCredential } from "./access";

export async function requireSensitive(
  ctx: QueryCtx,
  credentialId: Id<"mcpCredentials">,
  requested: Infer<typeof operation>
) {
  const access = await requireCredential(ctx, credentialId, requested === "reveal" ? "view" : "manage");
  await requireWorkspace(ctx, access.credential.workspaceId, true);
  if (requested === "reveal" && access.permission === "use")
    throw new ConvexError("Use permission does not allow revealing credentials.");
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId) throw new ConvexError("Sign in again before verifying this operation.");
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== access.user._id || session.expirationTime <= Date.now())
    throw new ConvexError("Your session expired. Sign in again.");
  return { ...access, session };
}
export async function requireProof(ctx: QueryCtx, proofId: Id<"mcpStepUps">, requested: Infer<typeof operation>) {
  const proof = await ctx.db.get(proofId);
  if (!proof || proof.operation !== requested || proof.consumed || proof.expiresAt <= Date.now())
    throw new ConvexError("Verify your password again for this operation.");
  const access = await requireSensitive(ctx, proof.credentialId, requested);
  if (
    proof.actorId !== access.user._id ||
    proof.sessionId !== access.session._id ||
    proof.credentialRevision !== access.credential.revision
  )
    throw new ConvexError("Verification no longer matches this session or credential. Verify again.");
  return { ...access, proof };
}
