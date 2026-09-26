import type { ISummonOpportunityDetail, TProject } from "@plane/types";

const PROJECT_ADMIN_ROLE = 20;

export type TDeliveryHandoffState =
  | { kind: "linked"; project: NonNullable<ISummonOpportunityDetail["delivery_project"]> }
  | { kind: "not_won" }
  | { kind: "needs_client" }
  | { kind: "ready" };

/** A link outlives stage corrections, so it wins over every other state. */
export const deliveryHandoffState = (
  opportunity: Pick<ISummonOpportunityDetail, "stage" | "client" | "delivery_project">
): TDeliveryHandoffState => {
  if (opportunity.delivery_project) return { kind: "linked", project: opportunity.delivery_project };
  if (opportunity.stage !== "won") return { kind: "not_won" };
  if (!opportunity.client) return { kind: "needs_client" };
  return { kind: "ready" };
};

/** Projects the server will accept for Link existing project: active ones the viewer administers. */
export const linkableDeliveryProjects = (
  projects: Array<Pick<TProject, "id" | "identifier" | "name" | "member_role" | "archived_at"> | undefined>
) =>
  projects
    .flatMap((project) =>
      project && project.member_role === PROJECT_ADMIN_ROLE && !project.archived_at
        ? [{ id: project.id, identifier: project.identifier, name: project.name }]
        : []
    )
    .sort((left, right) => left.name.localeCompare(right.name));

/** Client detail links here to open New opportunity with that client preselected. */
export const opportunityCreateHref = (workspaceSlug: string, clientId: string) =>
  `/${workspaceSlug}/summon/opportunities/?${new URLSearchParams({ create: "1", client: clientId })}`;

export const opportunityCreateIntent = (searchParams: Pick<URLSearchParams, "get">) => ({
  open: searchParams.get("create") === "1",
  client: searchParams.get("client") ?? "",
});
