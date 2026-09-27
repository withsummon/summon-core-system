import { expect, test } from "vitest";
import { credentialCapabilities } from "../access";
import { toolCapabilities, validateTool } from "../tools";

test("reveal capability requires non-guest workspace role and view or manage permission", () => {
  for (const role of ["admin", "member", "guest"] as const) {
    for (const permission of ["view", "use", "manage"] as const) {
      expect(credentialCapabilities(role, "guest", permission, "active")).toMatchObject({
        canManage: false,
        canUse: false,
        canReveal: role !== "guest" && permission !== "use",
      });
    }
  }
});
test("every advertised MCP action validates and project restrictions remove the rejected permutations", () => {
  const all = toolCapabilities({ remoteProjectId: null });
  for (const remoteProjectId of [null, "project-123"]) {
    const available = toolCapabilities({ remoteProjectId });
    for (const { tool, actions } of all) {
      for (const { action, write } of actions) {
        const validate = () =>
          validateTool(tool, JSON.stringify({ action, ...(remoteProjectId ? { project_id: remoteProjectId } : {}) }), {
            remoteWorkspaceSlug: "workspace",
            remoteProjectId,
          });
        if (available.some((entry) => entry.tool === tool && entry.actions.some((item) => item.action === action))) {
          expect(validate().write).toBe(write);
        } else expect(validate).toThrow("outside the credential project scope");
      }
    }
  }
});
