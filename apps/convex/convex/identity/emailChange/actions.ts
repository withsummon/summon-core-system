"use node";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { collectAccountProof } from "../accounts/proof";
import { sendAccountEmail } from "../mail/sender";
function digest(nonce: string, code: string) {
  return createHash("sha256").update(`${nonce}:${code}`).digest("hex");
}
export const request = action({
  args: { newEmail: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ challenge: string }> => {
    const proof = await collectAccountProof(ctx, args.password);
    const nonce = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const pending = await ctx.runMutation(internal.identity.emailChange.index.begin, {
      ...proof,
      newEmail: args.newEmail,
      nonce,
      digest: digest(nonce, code),
    });
    try {
      await sendAccountEmail(
        pending.email,
        "Verify your new Summon email",
        `Your Summon email change code is:\n\n${code}\n\nThis code expires in 10 minutes. If you did not request it, ignore this message.`
      );
    } catch {
      await ctx.runMutation(internal.identity.emailChange.index.fail, { nonce });
      throw new ConvexError("Account email could not be sent. Request a new code after the cooldown.");
    }
    return { challenge: nonce };
  },
});
export const confirm = action({
  args: { challenge: v.string(), code: v.string(), password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ changed: true; signInRequired: true }> => {
    if (args.challenge.length > 64 || args.code.length > 64) throw new ConvexError("Invalid email change code.");
    const proof = await collectAccountProof(ctx, args.password);
    const result = await ctx.runMutation(internal.identity.emailChange.index.commit, {
      ...proof,
      nonce: args.challenge,
      digest: digest(args.challenge, args.code),
    });
    if (!result.changed) throw new ConvexError("Invalid or expired email change code. Request a new code.");
    return { changed: true, signInRequired: true };
  },
});
