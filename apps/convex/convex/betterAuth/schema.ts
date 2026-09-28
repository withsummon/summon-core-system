import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

// The installed native generator does not include API-key index attributes.
export default defineSchema({
  ...tables,
  apikey: tables.apikey.index("referenceId", ["referenceId"]).index("key", ["key"]).index("expiresAt", ["expiresAt"]),
});
