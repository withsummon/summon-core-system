/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { matchRoutes } from "react-router";
import type { RouteObject, UNSAFE_AssetsManifest } from "react-router";

declare global {
  interface Window {
    // Written by React Router's <Scripts /> before the client entry runs.
    __reactRouterManifest: UNSAFE_AssetsManifest;
    __reactRouterContext: { basename?: string };
  }
}

type TManifestRoute = Pick<
  NonNullable<UNSAFE_AssetsManifest["routes"][string]>,
  "id" | "parentId" | "path" | "index" | "caseSensitive" | "module" | "imports"
>;

/**
 * Starts fetching every module the current URL's routes need, all at once.
 *
 * In SPA mode the prerendered index.html only preloads the root route, and React
 * Router loads the other matched routes with a bare `import()`. The browser then
 * finds their imports one level at a time, so a cold load pays a round trip per
 * level of the import graph before anything renders.
 *
 * The links are removed straight away: the fetches carry on into the module map,
 * and React 18 hydrates the whole document, so extra <head> nodes would not match.
 */
export function preloadRouteModules() {
  const links = listRouteModules(
    window.__reactRouterManifest.routes,
    window.location.pathname,
    window.__reactRouterContext.basename
  ).map((href) => Object.assign(document.createElement("link"), { rel: "modulepreload", href }));
  document.head.append(...links);
  links.forEach((link) => link.remove());
}

/** Lists each route matching `pathname`, outermost first, as its module followed by its static imports. */
export function listRouteModules(
  routes: Record<string, TManifestRoute | undefined>,
  pathname: string,
  basename?: string
): string[] {
  const routeObjects = new Map<string, RouteObject>();
  const manifestRouteOf = new Map<RouteObject, TManifestRoute>();
  for (const route of Object.values(routes)) {
    if (!route) continue;
    const { id, path, caseSensitive } = route;
    const routeObject: RouteObject = route.index
      ? { id, path, caseSensitive, index: true }
      : { id, path, caseSensitive, children: [] };
    routeObjects.set(id, routeObject);
    manifestRouteOf.set(routeObject, route);
  }

  const tree: RouteObject[] = [];
  for (const [routeObject, route] of manifestRouteOf) {
    const parent = route.parentId ? routeObjects.get(route.parentId) : undefined;
    (parent?.children ?? tree).push(routeObject);
  }

  const hrefs = new Set<string>();
  for (const match of matchRoutes(tree, pathname, basename) ?? []) {
    const route = manifestRouteOf.get(match.route);
    if (!route) continue;
    hrefs.add(route.module);
    route.imports?.forEach((href) => hrefs.add(href));
  }
  return [...hrefs];
}
