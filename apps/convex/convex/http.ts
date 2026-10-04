import { reply as assistantReply, options as assistantOptions } from "./assistant/http";
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { betterAuthEnabled } from "./auth.config";
import { authComponent, createAuth, siteUrl } from "./better_auth";
import { read, options } from "./assets/http";
import { currentUser, options as externalUserOptions } from "./identity/external";
import { projects as externalProjects, options as externalProjectOptions } from "./projects/external";
const http = httpRouter();
if (betterAuthEnabled) {
  if (!siteUrl) throw new Error("SITE_URL is required for Better Auth.");
  authComponent.registerRoutesLazy(http, createAuth, {
    cors: true,
    trustedOrigins: [siteUrl],
  });
} else auth.addHttpRoutes(http);
http.route({ pathPrefix: "/assets/", method: "GET", handler: read });
http.route({ pathPrefix: "/assets/", method: "OPTIONS", handler: options });
http.route({ path: "/assistant/reply", method: "POST", handler: assistantReply });
http.route({ path: "/assistant/reply", method: "OPTIONS", handler: assistantOptions });
http.route({ path: "/api/v1/users/me/", method: "GET", handler: currentUser });
http.route({ path: "/api/v1/users/me/", method: "OPTIONS", handler: externalUserOptions });
http.route({ pathPrefix: "/api/v1/workspaces/", method: "GET", handler: externalProjects });
http.route({ pathPrefix: "/api/v1/workspaces/", method: "POST", handler: externalProjects });
http.route({ pathPrefix: "/api/v1/workspaces/", method: "PATCH", handler: externalProjects });
http.route({ pathPrefix: "/api/v1/workspaces/", method: "OPTIONS", handler: externalProjectOptions });
export default http;
