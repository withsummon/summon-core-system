import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IUserSettings, IWorkspace } from "@plane/types";

// The app resolves `next/*` through Vite aliases; give `bun test` the same mapping.
// The specifier is widened so tsc (which has no bun types) doesn't resolve it.
const bunTest: string = "bun:test";
const { mock } = (await import(bunTest)) as { mock: { module: (id: string, load: () => unknown) => unknown } };
await mock.module("next/link", () => import("@/app/compat/next/link"));
const { getWorkspaceRedirectionUrl } = await import("./authentication-redirect");

const settings = (slugs: { last?: string; fallback?: string }) =>
  ({
    workspace: { last_workspace_slug: slugs.last, fallback_workspace_slug: slugs.fallback },
  }) as IUserSettings;

const workspaces = { "ws-1": { id: "ws-1", slug: "acme" } } as unknown as Record<string, IWorkspace>;

describe("getWorkspaceRedirectionUrl", () => {
  it("opens the last workspace at its Summon home", () => {
    assert.equal(getWorkspaceRedirectionUrl(null, settings({ last: "acme" }), workspaces), "/acme/summon");
  });

  it("falls back to the fallback workspace", () => {
    assert.equal(getWorkspaceRedirectionUrl(null, settings({ fallback: "acme" }), workspaces), "/acme/summon");
  });

  it("prefers a valid next path", () => {
    assert.equal(
      getWorkspaceRedirectionUrl("/acme/projects", settings({ last: "acme" }), workspaces),
      "/acme/projects"
    );
  });

  it("sends users without a known workspace to create one", () => {
    assert.equal(getWorkspaceRedirectionUrl(null, settings({ last: "gone" }), workspaces), "/create-workspace");
    assert.equal(getWorkspaceRedirectionUrl(null, undefined, undefined), "/create-workspace");
  });
});
