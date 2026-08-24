import type { ISummonHomeSummary, ISummonProjectOverview, ISummonResourceLink, TProject } from "@plane/types";

type TProjectSummary = ISummonHomeSummary["projects"][number];

export const summonProjectCreateOptions = (pathname: string) =>
  /^\/[^/]+\/summon\/projects\/?$/.test(pathname)
    ? ({ closeOnCreate: true, data: { cover_image_url: "" } } as const)
    : ({} as const);

export const mergeProjectSummaries = (
  summaries: TProjectSummary[],
  projects: Pick<TProject, "id" | "identifier" | "name">[]
): TProjectSummary[] => {
  const knownIds = new Set(summaries.map(({ id }) => id));
  return [
    ...summaries,
    ...projects
      .filter(({ id }) => !knownIds.has(id))
      .map(({ id, identifier, name }) => ({ id, identifier, name, health: "not_assessed", completion: 0 })),
  ];
};

export const projectHealthLabel = (health: string) => {
  if (health === "not_assessed") return "Belum dinilai";
  return health.replaceAll("_", " ").replace(/^./, (value) => value.toUpperCase());
};

export const projectHealthTone = (health: string) => (health === "not_assessed" ? "neutral" : "default");

export const projectProfileForm = (profile: ISummonProjectOverview["profile"]) => ({
  client: profile?.client || "",
  delivery_status: profile?.delivery_status || "not_assessed",
  phase: profile?.phase || "",
  health: profile?.health || "not_assessed",
  start_date: profile?.start_date || "",
  target_date: profile?.target_date || "",
  budget: profile?.budget || "",
});

export const filterProjectResources = (resources: ISummonResourceLink[], category: string) =>
  resources.filter((resource) => resource.category === category);

export const projectProfileDateError = (startDate: string, targetDate: string) =>
  startDate && targetDate && startDate > targetDate ? "Start date must not be after target date." : "";
