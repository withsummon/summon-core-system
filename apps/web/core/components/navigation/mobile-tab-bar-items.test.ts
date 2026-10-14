import assert from "node:assert/strict";
import test from "node:test";
import type { IWorkspaceSidebarNavigationItem } from "@plane/constants";
import { SUMMON_ASSISTANT_NAVIGATION_ITEM, SUMMON_MODULES } from "@plane/constants";
import { EUserWorkspaceRoles } from "@plane/types";
import { getMobileNavigation } from "./mobile-tab-bar-items";

const asRole = (role: EUserWorkspaceRoles) => (item: IWorkspaceSidebarNavigationItem) => item.access.includes(role);
const keys = (links: { item: IWorkspaceSidebarNavigationItem }[]) => links.map((link) => link.item.key);

test("the tab row holds Home, Projects, Tasks and Assistant, and marks the open page", () => {
  const nav = getMobileNavigation("acme", "/acme/summon/tasks/", asRole(EUserWorkspaceRoles.ADMIN));
  assert.deepEqual(keys(nav.tabs), ["summon", "summon_projects", "summon_tasks", "summon_assistant"]);
  assert.deepEqual(
    nav.tabs.filter((link) => link.isActive).map((link) => link.item.key),
    ["summon_tasks"]
  );
  assert.equal(nav.isMoreActive, false);
});

test("Home is active only on the Summon root, not on its child pages", () => {
  const home = getMobileNavigation("acme", "/acme/summon/", asRole(EUserWorkspaceRoles.ADMIN));
  assert.equal(home.tabs[0].isActive, true);
  const detail = getMobileNavigation("acme", "/acme/summon/projects/42/", asRole(EUserWorkspaceRoles.ADMIN));
  assert.equal(detail.tabs[0].isActive, false);
  assert.equal(detail.tabs[1].isActive, true);
});

test("More is the active tab while one of its destinations is open", () => {
  const nav = getMobileNavigation("acme", "/acme/summon/clients/7/", asRole(EUserWorkspaceRoles.ADMIN));
  assert.equal(nav.isMoreActive, true);
  assert.equal(
    nav.tabs.some((link) => link.isActive),
    false
  );
});

test("an admin sees every Summon destination exactly once across the tabs and the More groups", () => {
  const nav = getMobileNavigation("acme", "/acme/summon/", asRole(EUserWorkspaceRoles.ADMIN));
  const all = [...keys(nav.tabs), ...nav.groups.flatMap((group) => keys(group.links))];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(
    new Set(all),
    new Set([...SUMMON_MODULES.map((module) => module.key), SUMMON_ASSISTANT_NAVIGATION_ITEM.key])
  );
});

test("members never see deals, reports or settings, and guests also lose credentials", () => {
  const member = getMobileNavigation("acme", "/acme/summon/", asRole(EUserWorkspaceRoles.MEMBER));
  const memberKeys = new Set(member.groups.flatMap((group) => keys(group.links)));
  for (const hidden of ["summon_opportunities", "summon_reports", "summon_settings"]) {
    assert.ok(!memberKeys.has(hidden), `${hidden} is admin only`);
  }
  assert.ok(memberKeys.has("summon_credentials"));
  assert.ok(!member.groups.some((group) => group.key === "workspace"), "an empty group is dropped");

  const guest = getMobileNavigation("acme", "/acme/summon/", asRole(EUserWorkspaceRoles.GUEST));
  assert.ok(!guest.groups.flatMap((group) => keys(group.links)).includes("summon_credentials"));
  assert.equal(guest.tabs.length, 4);
});
