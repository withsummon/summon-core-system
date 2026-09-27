import { ConvexError } from "convex/values";
function jsonCompatible(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonCompatible);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(jsonCompatible);
}
export function boundedJson(value: unknown, label: string, max: number) {
  if (!jsonCompatible(value) || JSON.stringify(value).length > max)
    throw new ConvexError(`${label} must be JSON within ${max} characters.`);
  return value;
}
