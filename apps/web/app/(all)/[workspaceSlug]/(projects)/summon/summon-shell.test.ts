import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("workspace root redirects to Summon home", () => {
  const workspaceRoot = source("../page.tsx");

  assert.match(workspaceRoot, /<Navigate to=\{`\/\$\{params\.workspaceSlug\}\/summon`\} replace \/>/);
});

test("primary sidebar only renders Summon navigation", () => {
  const sidebar = source("../../../../../core/components/workspace/sidebar/sidebar-menu-items.tsx");
  const appSidebar = source("../sidebar.tsx");
  const translations = source("../../../../../../../packages/i18n/src/locales/en/common.json");

  assert.match(sidebar, /SUMMON_WORKSPACE_NAVIGATION_ITEMS\.map/);
  assert.doesNotMatch(sidebar, /WORKSPACE_SIDEBAR_STATIC_NAVIGATION_ITEMS/);
  assert.doesNotMatch(sidebar, /WORKSPACE_SIDEBAR_DYNAMIC_NAVIGATION_ITEMS/);
  assert.match(sidebar, /Advanced Plane/);
  assert.doesNotMatch(appSidebar, /SidebarProjectsList/);
  assert.doesNotMatch(appSidebar, /SidebarFavoritesMenu/);
  assert.doesNotMatch(translations, /"summon":\s*\{[\s\S]*?"(?:overview|projects|tasks)":\s*"Summon /);
});

test("community plan badge is disabled in the Summon sidebar", () => {
  const appSidebar = source("../sidebar.tsx");

  assert.match(appSidebar, /showEditionBadge=\{false\}/);
});

test("sidebar toggle stays reachable when the sidebar is closed", () => {
  const topNavigation = source("../../../../../core/components/navigation/top-navigation-root.tsx");
  const resizableSidebar = source("../../../../../core/components/sidebar/resizable-sidebar.tsx");

  assert.match(topNavigation, /sidebarCollapsed/);
  assert.match(topNavigation, /!sidebarCollapsed && "md:hidden"/);
  assert.match(topNavigation, /AppSidebarToggleButton/);
  assert.match(resizableSidebar, /max-md:absolute/);
  assert.match(resizableSidebar, /aria-label="Close sidebar"/);
});

test("sidebar drag handles do not nest buttons", () => {
  for (const file of [
    "../../../../../core/components/workspace/sidebar/projects-list-item.tsx",
    "../../../../../core/components/workspace/sidebar/extended-sidebar-item.tsx",
    "../../../../../core/components/workspace/sidebar/favorites/favorite-folder.tsx",
  ]) {
    assert.doesNotMatch(source(file), /<button[\s\S]{0,500}<DragHandle/);
  }

  assert.doesNotMatch(
    source("../../../../../core/components/workspace/sidebar/projects-list-item.tsx"),
    /customButton=\{[\s\S]{0,300}<IconButton/
  );
});
