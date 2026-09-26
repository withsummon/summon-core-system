import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

const modules = import.meta.glob("/convex/**/*.{ts,js}");

export async function workspaceJourney() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: "Owner" }));
  const owner = t.withIdentity({ subject: userId });
  const workspaceId = await owner.mutation(api.workspaces.index.create, { name: "Workspace", slug: "workspace" });
  const projectId = await owner.mutation(api.projects.index.create, {
    workspaceId,
    name: "Delivery",
    identifier: "DLV",
  });
  return { t, owner, userId, workspaceId, projectId };
}
