/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as commercial_clients from "../commercial/clients.js";
import type * as commercial_contacts from "../commercial/contacts.js";
import type * as commercial_delivery from "../commercial/delivery.js";
import type * as commercial_directory from "../commercial/directory.js";
import type * as commercial_opportunities from "../commercial/opportunities.js";
import type * as commercial_validation from "../commercial/validation.js";
import type * as http from "../http.js";
import type * as identity_access from "../identity/access.js";
import type * as identity_index from "../identity/index.js";
import type * as projects_create from "../projects/create.js";
import type * as projects_index from "../projects/index.js";
import type * as tasks_index from "../tasks/index.js";
import type * as workspaces_index from "../workspaces/index.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "commercial/clients": typeof commercial_clients;
  "commercial/contacts": typeof commercial_contacts;
  "commercial/delivery": typeof commercial_delivery;
  "commercial/directory": typeof commercial_directory;
  "commercial/opportunities": typeof commercial_opportunities;
  "commercial/validation": typeof commercial_validation;
  http: typeof http;
  "identity/access": typeof identity_access;
  "identity/index": typeof identity_index;
  "projects/create": typeof projects_create;
  "projects/index": typeof projects_index;
  "tasks/index": typeof tasks_index;
  "workspaces/index": typeof workspaces_index;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
