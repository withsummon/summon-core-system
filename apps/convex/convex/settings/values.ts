import { ConvexError, v, type Infer } from "convex/values";
import { text } from "../commercial/validation";
import { settingsFields } from "./schema";
import { DEFAULT_WORKSPACE_TIMEZONE, validateTimezone } from "./timezone";
const settingsValue = v.object(settingsFields);
export const defaultSettings: Infer<typeof settingsValue> = {
  organizationSize: null,
  timezone: DEFAULT_WORKSPACE_TIMEZONE,
  industry: "",
  description: "",
  currency: "IDR",
  workweek: [],
};
export function validateSettings(args: Infer<typeof settingsValue>) {
  const organizationSize = args.organizationSize === null ? null : text(args.organizationSize, "Organization size", 20);
  const industry = text(args.industry, "Industry", 120);
  const description = text(args.description, "Description", 100000);
  if (!/^[A-Z]{3}$/.test(args.currency)) throw new ConvexError("Enter a three-letter uppercase currency code.");
  if (new Set(args.workweek).size !== args.workweek.length) throw new ConvexError("Workweek days must be unique.");
  validateTimezone(args.timezone);
  return {
    organizationSize,
    industry,
    description,
    timezone: args.timezone,
    currency: args.currency,
    workweek: args.workweek,
  };
}
