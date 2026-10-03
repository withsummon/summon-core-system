import { ConvexError } from "convex/values";
export function validateTranscript(transcript: string, language: string) {
  const source = transcript.trim();
  if (!source || source.length > 120000 || language.length > 100)
    throw new ConvexError("Supply a transcript of at most 120,000 characters and a valid language.");
  return { transcript: source, language };
}
