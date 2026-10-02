import type { Doc } from "@summon/convex/data-model";

export const OPPORTUNITY_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const satisfies readonly Doc<"opportunities">["stage"][];

export const OPPORTUNITY_STAGE_LABEL: Record<Doc<"opportunities">["stage"], string> = {
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
export const OPPORTUNITY_STAGE_TONE: Record<Doc<"opportunities">["stage"], { dot: string; chip: string; bar: string }> =
  {
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

export type TStageFilter = "all" | Doc<"opportunities">["stage"];

export const parseStageFilter = (value: string | null): TStageFilter =>
  OPPORTUNITY_STAGES.find((stage) => stage === value) ?? "all";

export const stageCounts = (opportunities: Pick<Doc<"opportunities">, "stage">[]) =>
  new Map(
    OPPORTUNITY_STAGES.map((stage) => [stage, opportunities.filter((item) => item.stage === stage).length] as const)
  );

/** Visible rows grouped in pipeline order, most recently updated first within each stage. */
export const groupByStage = <T extends Pick<Doc<"opportunities">, "stage">>(opportunities: T[]) =>
  OPPORTUNITY_STAGES.flatMap((stage) => {
    const items = opportunities.filter((item) => item.stage === stage);
    return items.length ? [{ stage, items }] : [];
  });

export const opportunitiesHref = (
  workspaceSlug: string,
  params: { stage?: TStageFilter; opportunity?: string | null; search?: string; create?: boolean }
) => {
  const search = new URLSearchParams();
  if (params.stage && params.stage !== "all") search.set("stage", params.stage);
  if (params.opportunity) search.set("opportunity", params.opportunity);
  if (params.search) search.set("search", params.search);
  if (params.create) search.set("create", "1");
  const query = search.toString();
  return `/${workspaceSlug}/summon/opportunities/${query ? `?${query}` : ""}`;
};
