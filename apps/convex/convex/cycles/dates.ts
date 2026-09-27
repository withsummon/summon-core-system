import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
export function validateCycleDates(startDate: string | null, endDate: string | null) {
  if ((startDate === null) !== (endDate === null)) throw new ConvexError("Set both cycle dates or leave both empty.");
  for (const value of [startDate, endDate]) {
    if (value === null) continue;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      throw new ConvexError("Enter valid calendar dates.");
  }
  if (startDate && endDate && startDate > endDate) throw new ConvexError("Cycle start date cannot exceed end date.");
}
export function validateCycleClock(now: number) {
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime()))
    throw new ConvexError("Invalid cycle clock.");
}
export function cyclePhase(cycle: Pick<Doc<"cycles">, "startDate" | "endDate" | "timezone">, now = Date.now()) {
  validateCycleClock(now);
  if (!cycle.startDate || !cycle.endDate) return "draft" as const;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", { timeZone: cycle.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return today < cycle.startDate
    ? ("upcoming" as const)
    : today > cycle.endDate
      ? ("completed" as const)
      : ("current" as const);
}
