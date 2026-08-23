import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const navigation = read("apps/web/core/components/power-k/config/navigation/commands.ts");
const navigationRoot = read("apps/web/core/components/power-k/config/navigation/root.ts");
const creation = read("apps/web/core/components/power-k/config/creation/command.ts");
const creationRoot = read("apps/web/core/components/power-k/config/creation/root.ts");

test("Power-K keeps native commands and adds every Summon destination", () => {
  for (const nativeCommand of [
    "open_workspace",
    "nav_home",
    "nav_inbox",
    "nav_your_work",
    "nav_account_settings",
    "open_project",
    "nav_projects_list",
    "nav_all_workspace_work_items",
    "nav_assigned_workspace_work_items",
    "nav_created_workspace_work_items",
    "nav_subscribed_workspace_work_items",
    "nav_workspace_analytics",
    "nav_workspace_drafts",
    "nav_workspace_archives",
    "open_workspace_setting",
    "nav_workspace_settings",
    "nav_project_work_items",
    "open_project_cycle",
    "nav_project_cycles",
    "open_project_module",
    "nav_project_modules",
    "open_project_view",
    "nav_project_views",
    "nav_project_pages",
    "nav_project_intake",
    "nav_project_archives",
    "open_project_setting",
    "nav_project_settings",
  ]) {
    assert.match(navigation, new RegExp(`${nativeCommand}:`));
    assert.match(navigationRoot, new RegExp(`optionsList\\["${nativeCommand}"\\]`));
  }

  for (const destination of [
    "home",
    "projects",
    "opportunities",
    "clients",
    "tasks",
    "documents",
    "knowledge",
    "resources",
    "meetings",
    "automation",
    "credentials",
    "reports",
    "notifications",
    "settings",
    "assistant",
  ]) {
    const command = `nav_summon_${destination}`;
    assert.match(navigation, new RegExp(`${command}:`));
    assert.match(navigationRoot, new RegExp(`optionsList\\["${command}"\\]`));
  }
});

test("Power-K keeps native creation and adds Summon form actions", () => {
  for (const nativeCommand of [
    "create_work_item",
    "create_page",
    "create_view",
    "create_cycle",
    "create_module",
    "create_project",
    "create_workspace",
  ]) {
    assert.match(creation, new RegExp(`${nativeCommand}:`));
    assert.match(creationRoot, new RegExp(`optionsList\\["${nativeCommand}"\\]`));
  }

  for (const command of [
    "create_summon_client",
    "create_summon_opportunity",
    "create_summon_meeting",
    "open_summon_automation",
  ]) {
    assert.match(creation, new RegExp(`${command}:`));
    assert.match(creationRoot, new RegExp(`optionsList\\["${command}"\\]`));
  }
});

test("Credential and settings screens expose only safe configuration fields", () => {
  const credentialPage = read("apps/web/app/(all)/[workspaceSlug]/(projects)/summon/credentials/page.tsx");
  const credentialDrawer = read("apps/web/core/components/summon/credential-drawer.tsx");
  const settingsPage = read("apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx");

  assert.doesNotMatch(`${credentialPage}\n${credentialDrawer}`, /secret_ciphertext|api[_-]?key/i);
  assert.match(credentialPage, /type="password"/);
  assert.match(credentialDrawer, /type="password"/);
  assert.match(settingsPage, /getAIStatus/);
  assert.match(settingsPage, /mcp\/http\/api-key\/mcp/);
  assert.doesNotMatch(settingsPage, /secret_ciphertext|base[_-]?url|timeout/i);
});
