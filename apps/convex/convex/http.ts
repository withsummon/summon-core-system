import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { read, options } from "./assets/http";
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ pathPrefix: "/assets/", method: "GET", handler: read });
http.route({ pathPrefix: "/assets/", method: "OPTIONS", handler: options });
export default http;
