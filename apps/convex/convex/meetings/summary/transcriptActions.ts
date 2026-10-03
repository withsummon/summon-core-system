"use node";
import type { Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { convertGeneratedText } from "../../lib/documentConversion";
import { validateTranscript } from "./validation";
import { saveArgs } from "./transcripts";
export const save = action({
  args: saveArgs,
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const validated = validateTranscript(args.transcript, args.language);
    const prepared = await ctx.runQuery(internal.meetings.summary.transcripts.prepare, args);
    return ctx.runMutation(internal.meetings.summary.transcripts.commit, {
      ...args,
      ...convertGeneratedText(validated.transcript, prepared.title, prepared.binary),
    });
  },
});
