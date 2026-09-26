import type { ISummonOpportunity, TSummonOpportunityStage } from "@plane/types";

export const OPPORTUNITY_STAGES: TSummonOpportunityStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export const OPPORTUNITY_STAGE_LABEL: Record<TSummonOpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Closed won",
  lost: "Closed lost",
};

/** One semantic treatment per stage, always paired with its text label. */
/**
 * One semantic treatment per stage from the design system's label palettes, always paired with its text label.
 * Class names stay literal so Tailwind can generate them.
 */
export const OPPORTUNITY_STAGE_TONE: Record<TSummonOpportunityStage, { dot: string; chip: string; bar: string }> = {
  lead: { dot: "bg-label-grey-icon", chip: "bg-label-grey-bg text-label-grey-text", bar: "bg-label-grey-icon" },
  qualified: {
    dot: "bg-label-indigo-icon",
    chip: "bg-label-indigo-bg text-label-indigo-text",
    bar: "bg-label-indigo-icon",
  },
  proposal: { dot: "bg-accent-primary", chip: "bg-accent-subtle text-accent-primary", bar: "bg-accent-primary" },
  negotiation: {
    dot: "bg-label-yellow-icon",
    chip: "bg-label-yellow-bg text-label-yellow-text",
    bar: "bg-label-yellow-icon",
  },
  won: {
    dot: "bg-label-emerald-icon",
    chip: "bg-label-emerald-bg text-label-emerald-text",
    bar: "bg-label-emerald-icon",
  },
  lost: {
    dot: "bg-label-crimson-icon",
    chip: "bg-label-crimson-bg text-label-crimson-text",
    bar: "bg-label-crimson-icon",
  },
};

export type TStageFilter = "all" | TSummonOpportunityStage;

export const parseStageFilter = (value: string | null): TStageFilter =>
  OPPORTUNITY_STAGES.find((stage) => stage === value) ?? "all";

export const stageCounts = (opportunities: Pick<ISummonOpportunity, "stage">[]) =>
  new Map(
    OPPORTUNITY_STAGES.map((stage) => [stage, opportunities.filter((item) => item.stage === stage).length] as const)
  );

/** Visible rows grouped in pipeline order, most recently updated first within each stage. */
export const groupByStage = <T extends Pick<ISummonOpportunity, "stage" | "updated_at">>(opportunities: T[]) =>
  OPPORTUNITY_STAGES.flatMap((stage) => {
    const items = opportunities
      .filter((item) => item.stage === stage)
      // oxlint-disable-next-line unicorn/no-array-sort -- toSorted needs ES2023 lib; this sorts a fresh filtered copy.
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    return items.length ? [{ stage, items }] : [];
  });

/**
 * The inspector only ever shows a visible row. An explicitly requested row wins while it stays visible;
 * otherwise the first visible row is a passive fallback, which narrow layouts do not open on their own.
 */
export const resolveOpportunitySelection = <T extends Pick<ISummonOpportunity, "id">>(
  visible: T[],
  requestedId: string | null
): { selected: T | undefined; explicit: boolean } => {
  const requested = requestedId ? visible.find((item) => item.id === requestedId) : undefined;
  return requested ? { selected: requested, explicit: true } : { selected: visible[0], explicit: false };
};

export const opportunitiesHref = (
  workspaceSlug: string,
  params: { stage?: TStageFilter; opportunity?: string | null }
) => {
  const search = new URLSearchParams();
  if (params.stage && params.stage !== "all") search.set("stage", params.stage);
  if (params.opportunity) search.set("opportunity", params.opportunity);
  const query = search.toString();
  return `/${workspaceSlug}/summon/opportunities/${query ? `?${query}` : ""}`;
};
