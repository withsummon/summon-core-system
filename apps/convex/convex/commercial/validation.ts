import type { PaginationOptions } from "convex/server";
import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { clientFields, contactFields, opportunityFields, profileFields } from "./schema";

export function text(value: string, field: string, max: number, required = false) {
  const trimmed = value.trim();
  if (trimmed.length > max || (required && !trimmed))
    throw new ConvexError(`${field} must contain ${required ? "1" : "0"}–${max} characters.`);
  return trimmed;
}
export function date(value: string | null) {
  if (value === null) return null;
  if (
    value.startsWith("0000") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ConvexError("Enter a valid ISO calendar date.");
  return value;
}
// Decimal(18,2) stays a decimal string across storage and the public API. No Number conversion.
export function money(value: string | null) {
  if (value === null) return null;
  if (!/^-?\d{1,16}(\.\d{1,2})?$/.test(value))
    throw new ConvexError("Enter a decimal amount with at most 16 integer digits and two decimal places.");
  const [integer, fraction = ""] = value.split(".");
  return `${BigInt(integer).toString() === "0" && value.startsWith("-") ? "-0" : BigInt(integer).toString()}.${fraction.padEnd(2, "0")}`;
}
export function probability(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100)
    throw new ConvexError("Probability must be an integer between 0 and 100.");
  return value;
}
function email(value: string) {
  const parsed = text(value, "Email", 254);
  if (parsed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed)) throw new ConvexError("Enter a valid email address.");
  return parsed;
}
function website(value: string) {
  const parsed = text(value, "Website", 200);
  if (!parsed) return parsed;
  let url: URL;
  try {
    url = new URL(parsed);
  } catch {
    throw new ConvexError("Enter a valid website URL.");
  }
  if (!["http:", "https:", "ftp:", "ftps:"].includes(url.protocol) || !url.hostname)
    throw new ConvexError("Enter a valid website URL.");
  return parsed;
}
export async function validateOwner(ctx: QueryCtx, workspaceId: Id<"workspaces">, ownerId: Id<"users"> | null) {
  if (ownerId === null) return;
  const member = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", ownerId))
    .unique();
  if (!member?.active) throw new ConvexError("Owner must be an active member of this workspace.");
}
export async function requireClient(ctx: QueryCtx, workspaceId: Id<"workspaces">, clientId: Id<"clients">) {
  const client = await ctx.db.get(clientId);
  if (!client || client.deleted || client.workspaceId !== workspaceId)
    throw new ConvexError("Client not found in this workspace.");
  return client;
}
export async function validateClient(ctx: QueryCtx, workspaceId: Id<"workspaces">, clientId: Id<"clients"> | null) {
  if (clientId !== null) await requireClient(ctx, workspaceId, clientId);
}
const clientData = v.object(clientFields);
export function parseClient(data: Infer<typeof clientData>) {
  return {
    ...data,
    name: text(data.name, "Name", 255, true),
    companyName: text(data.companyName, "Company", 255),
    industry: text(data.industry, "Industry", 120),
    email: email(data.email),
    phone: text(data.phone, "Phone", 40),
    website: website(data.website),
    headOffice: text(data.headOffice, "Head office", 255),
    relationshipStartedAt: date(data.relationshipStartedAt),
    notes: text(data.notes, "Notes", 100000),
    externalSource: data.externalSource === null ? null : text(data.externalSource, "External source", 255),
    externalId: data.externalId === null ? null : text(data.externalId, "External ID", 255),
  };
}
const contactData = v.object(contactFields);
export function parseContact(data: Infer<typeof contactData>) {
  return {
    ...data,
    name: text(data.name, "Name", 255, true),
    title: text(data.title, "Title", 120),
    email: email(data.email),
    phone: text(data.phone, "Phone", 40),
  };
}
const opportunityData = v.object(opportunityFields);
export function parseOpportunity(data: Infer<typeof opportunityData>) {
  return {
    ...data,
    title: text(data.title, "Title", 255, true),
    product: text(data.product, "Product", 255),
    source: text(data.source, "Source", 120),
    description: text(data.description, "Description", 100000),
    value: money(data.value),
    probability: probability(data.probability),
    expectedCloseDate: date(data.expectedCloseDate),
  };
}
const profileData = v.object(profileFields);
export function parseProfile(data: Infer<typeof profileData>) {
  const startDate = date(data.startDate);
  const targetDate = date(data.targetDate);
  if (startDate && targetDate && startDate > targetDate)
    throw new ConvexError("Target date must not be before start date.");
  return { ...data, phase: text(data.phase, "Phase", 80), startDate, targetDate, budget: money(data.budget) };
}

export function pageBudget(options: PaginationOptions) {
  if (!Number.isSafeInteger(options.numItems) || options.numItems < 1 || options.numItems > 100)
    throw new ConvexError("Page size must be an integer between 1 and 100.");
  return { ...options, maximumRowsRead: 100, maximumBytesRead: 1000000 };
}
