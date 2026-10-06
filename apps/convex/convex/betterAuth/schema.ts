import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

// The installed native generator does not include API-key index attributes.
export default defineSchema({
  ...tables,
  rateLimit: tables.rateLimit.index("lastRequest", ["lastRequest"]),
  apikey: tables.apikey.index("referenceId", ["referenceId"]).index("key", ["key"]).index("expiresAt", ["expiresAt"]),
});
