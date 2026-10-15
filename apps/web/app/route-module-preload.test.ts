import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the source extension.
import { listRouteModules } from "./route-module-preload.ts";

const routes = {
  root: { id: "root", path: "", module: "/assets/root.js", imports: ["/assets/react.js"] },
  "(home)/layout": { id: "(home)/layout", parentId: "root", module: "/assets/home-layout.js" },
  "(home)/page": { id: "(home)/page", parentId: "(home)/layout", index: true, module: "/assets/sign-in.js" },
  "(all)/layout": { id: "(all)/layout", parentId: "root", module: "/assets/all-layout.js" },
  "(all)/[workspaceSlug]/layout": {
    id: "(all)/[workspaceSlug]/layout",
    parentId: "(all)/layout",
    module: "/assets/workspace-layout.js",
    imports: ["/assets/react.js", "/assets/sidebar.js", "/assets/modals.js"],
  },
  "(all)/[workspaceSlug]/(projects)/page": {
    id: "(all)/[workspaceSlug]/(projects)/page",
    parentId: "(all)/[workspaceSlug]/layout",
    path: ":workspaceSlug",
    module: "/assets/workspace-home.js",
    imports: ["/assets/sidebar.js", "/assets/home-widgets.js"],
  },
  "(all)/[workspaceSlug]/(projects)/projects/page": {
    id: "(all)/[workspaceSlug]/(projects)/projects/page",
    parentId: "(all)/[workspaceSlug]/layout",
    path: ":workspaceSlug/projects",
    module: "/assets/projects.js",
  },
};

test("lists every matched route module with its imports, once each", () => {
  assert.deepEqual(listRouteModules(routes, "/local-summon/"), [
    "/assets/root.js",
    "/assets/react.js",
    "/assets/all-layout.js",
    "/assets/workspace-layout.js",
    "/assets/sidebar.js",
    "/assets/modals.js",
    "/assets/workspace-home.js",
    "/assets/home-widgets.js",
  ]);
});

test("leaves out routes the URL does not match", () => {
  const modules = listRouteModules(routes, "/local-summon/projects");
  assert.ok(modules.includes("/assets/projects.js"));
  assert.ok(!modules.includes("/assets/workspace-home.js"));
  assert.ok(!modules.includes("/assets/sign-in.js"));
});

test("matches the index route under a pathless layout", () => {
  assert.deepEqual(listRouteModules(routes, "/"), [
    "/assets/root.js",
    "/assets/react.js",
    "/assets/home-layout.js",
    "/assets/sign-in.js",
  ]);
});

test("honors the router basename and returns nothing outside it", () => {
  assert.ok(listRouteModules(routes, "/app/local-summon", "/app").includes("/assets/workspace-home.js"));
  assert.deepEqual(listRouteModules(routes, "/elsewhere/local-summon", "/app"), []);
});
