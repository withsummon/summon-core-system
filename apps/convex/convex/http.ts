import { reply as assistantReply, options as assistantOptions } from "./assistant/http";
import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { betterAuthEnabled } from "./auth.config";
import { authComponent, createAuth, siteUrl } from "./better_auth";
import { read, options } from "./assets/http";
const http = httpRouter();
if (betterAuthEnabled)
  authComponent.registerRoutesLazy(http, createAuth, {
    basePath: "/api/better-auth",
    cors: true,
    trustedOrigins: [siteUrl],
  });
else auth.addHttpRoutes(http);
http.route({ pathPrefix: "/assets/", method: "GET", handler: read });
http.route({ pathPrefix: "/assets/", method: "OPTIONS", handler: options });
http.route({ path: "/assistant/reply", method: "POST", handler: assistantReply });
http.route({ path: "/assistant/reply", method: "OPTIONS", handler: assistantOptions });
export default http;
