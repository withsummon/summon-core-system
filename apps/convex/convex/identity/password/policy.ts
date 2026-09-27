import { ConvexError } from "convex/values";
export function validatePassword(password: string) {
  if (typeof password !== "string" || password.length < 8 || password.length > 1024)
    throw new ConvexError("Use a password between 8 and 1024 characters.");
}
export function requireSafeAuthLogging() {
  if (process.env.AUTH_LOG_LEVEL === "DEBUG" || process.env.AUTH_LOG_SECRETS === "true")
    throw new ConvexError("Disable authentication secret/debug logging before changing credentials.");
}
