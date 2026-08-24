import type { ISummonHomeSummary, ISummonResourceLink, TProject } from "@plane/types";

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
      .map(({ id, identifier, name }) => ({ id, identifier, name, health: "on_track", completion: 0 })),
  ];
};

export const filterProjectResources = (resources: ISummonResourceLink[], category: string) =>
  resources.filter((resource) => resource.category === category);

export const projectProfileDateError = (startDate: string, targetDate: string) =>
  startDate && targetDate && startDate > targetDate ? "Start date must not be after target date." : "";
