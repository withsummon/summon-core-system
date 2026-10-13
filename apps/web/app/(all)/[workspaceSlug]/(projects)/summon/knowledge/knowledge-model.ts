/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonClient, ISummonOpportunity, ISummonPageContext } from "@plane/types";

/** One accessible Plane page with the Summon context (client, opportunity, category) it may carry. */
export type TKnowledgeEntry = {
  page: {
    id?: string;
    name?: string;
    updated_at?: Date | string;
    created_by?: string | null;
    updated_by?: string | null;
  };
  project: { id: string; name: string };
  context?: Pick<ISummonPageContext, "client" | "opportunity" | "category">;
};

/** `all`, or one record the library narrows to, written `kind:id`. */
export type TKnowledgeContextFilter = "all" | `${"project" | "client" | "opportunity"}:${string}`;

export type TKnowledgeOption = { id: string; label: string };
export type TKnowledgeContextOptions = Record<"project" | "client" | "opportunity", TKnowledgeOption[]>;

export const ALL_CATEGORIES = "all";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const PAGE_SIZE = 10;

export const updatedTime = (entry: TKnowledgeEntry) => Date.parse(String(entry.page.updated_at ?? "")) || 0;

/** Most recently updated first. */
export const recentFirst = (entries: TKnowledgeEntry[]) =>
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is unavailable in the app's current TypeScript target.
  [...entries].sort((left, right) => updatedTime(right) - updatedTime(left));

/** Pages joined with their Summon context, newest first. */
export function knowledgeEntries(
  pages: Array<Pick<TKnowledgeEntry, "page" | "project">>,
  contexts: Array<Pick<ISummonPageContext, "page" | "client" | "opportunity" | "category">>
): TKnowledgeEntry[] {
  const contextByPage = new Map(contexts.map((context) => [context.page, context]));
  return recentFirst(
    pages.map(({ page, project }) => ({ page, project, context: page.id ? contextByPage.get(page.id) : undefined }))
  );
}

/** Real counts only: pages, the projects they live in, recent edits and the people behind them. */
export function knowledgeStats(entries: TKnowledgeEntry[], now: number) {
  const people = entries.flatMap(({ page }) => [page.created_by, page.updated_by]).filter(Boolean);
  return {
    pages: entries.length,
    projects: new Set(entries.map(({ project }) => project.id)).size,
    updatedThisWeek: entries.filter((entry) => now - updatedTime(entry) < WEEK_MS).length,
    contributors: new Set(people).size,
  };
}

/** Distinct options by id, alphabetical. */
export function uniqueOptions(options: TKnowledgeOption[]) {
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is unavailable in the app's current TypeScript target.
  return [...new Map(options.map((option) => [option.id, option])).values()].sort((left, right) =>
    left.label.localeCompare(right.label)
  );
}

/**
 * The records the library can narrow to: only ones that actually have pages. Pass no opportunities
 * for people without `commercial.view`.
 */
export function contextOptionsFor(
  entries: TKnowledgeEntry[],
  clients: Array<Pick<ISummonClient, "id" | "name">>,
  opportunities: Array<Pick<ISummonOpportunity, "id" | "title">>
): TKnowledgeContextOptions {
  const clientIds = new Set(entries.map((entry) => entry.context?.client));
  const opportunityIds = new Set(entries.map((entry) => entry.context?.opportunity));
  return {
    project: uniqueOptions(entries.map(({ project }) => ({ id: project.id, label: project.name }))),
    client: uniqueOptions(
      clients.filter((client) => clientIds.has(client.id)).map((client) => ({ id: client.id, label: client.name }))
    ),
    opportunity: uniqueOptions(
      opportunities
        .filter((opportunity) => opportunityIds.has(opportunity.id))
        .map((opportunity) => ({ id: opportunity.id, label: opportunity.title }))
    ),
  };
}

/** `lessons_learned` → `Lessons learned`. Pages without a Summon category read as plain pages. */
export function categoryLabel(category?: string) {
  const words = (category ?? "").replaceAll(/[_-]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Page";
}

/** Only the categories the workspace actually uses, alphabetically. */
export function knowledgeCategories(entries: TKnowledgeEntry[]) {
  const categories = new Set(entries.map((entry) => entry.context?.category).filter((value) => !!value) as string[]);
  // oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is unavailable in the app's current TypeScript target.
  return [...categories].sort((left, right) => left.localeCompare(right));
}

function matchesContext(entry: TKnowledgeEntry, filter: TKnowledgeContextFilter) {
  if (filter === "all") return true;
  const [kind, id] = filter.split(":");
  if (kind === "project") return entry.project.id === id;
  if (kind === "client") return entry.context?.client === id;
  return entry.context?.opportunity === id;
}

export function filterKnowledge(
  entries: TKnowledgeEntry[],
  filters: { query: string; category: string; context: TKnowledgeContextFilter }
) {
  const query = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    const text = `${entry.page.name ?? ""} ${entry.project.name} ${entry.context?.category ?? ""}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (filters.category !== ALL_CATEGORIES && entry.context?.category !== filters.category) return false;
    return matchesContext(entry, filters.context);
  });
}

/** Hand a question to the Assistant, which starts a chat with it in the composer. */
export const askHref = (workspaceSlug: string, question: string) =>
  `/${workspaceSlug}/summon/assistant/?q=${encodeURIComponent(question.trim())}`;

export const pageHref = (workspaceSlug: string, entry: TKnowledgeEntry) =>
  `/${workspaceSlug}/projects/${entry.project.id}/pages/${entry.page.id}/`;

/** Starter questions built from what the person last touched, so none of them is about an empty topic. */
export function starterQuestions(recent: TKnowledgeEntry[]) {
  const [latest] = recent;
  if (!latest) return [];
  const otherProject = recent.find((entry) => entry.project.id !== latest.project.id)?.project;
  return [
    `Summarize the latest pages in ${latest.project.name}`,
    `What changed recently in ${latest.page.name || "the latest page"}?`,
    otherProject ? `What should I read first about ${otherProject.name}?` : "",
  ].filter(Boolean);
}
