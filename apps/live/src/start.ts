/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { z } from "zod";
import { registerController } from "@plane/decorators";
import { DocumentController } from "./controllers/document.controller";
import { PdfExportController } from "./controllers/pdf-export.controller";
import { convexDocuments } from "./convex/documents";
import { ConvexHocuspocus } from "./convex/server";

const settings = z
  .object({
    CONVEX_URL: z.string().url(),
    CONVEX_SITE_URL: z.string().url(),
    CONVEX_LIVE_PORT: z.coerce.number().int().min(1).max(65535).default(1235),
    CONVEX_LIVE_HOST: z.string().default("0.0.0.0"),
    LIVE_BASE_PATH: z.string().startsWith("/").default("/live"),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
  })
  .parse(process.env);
const app = express();
app.use(helmet());
app.use(compression({ level: 6, threshold: 5000 }));
app.all(`${settings.LIVE_BASE_PATH}/health`, (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Allow", "GET");
  response
    .status(request.method === "GET" ? 200 : 405)
    .json(request.method === "GET" ? { status: "OK" } : { message: "Method Not Allowed" });
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: settings.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);
const router = express.Router();
registerController(router, DocumentController);
registerController(router, PdfExportController, [settings.CONVEX_URL, settings.CONVEX_SITE_URL]);
app.use(settings.LIVE_BASE_PATH, router);
app.use((_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(404).json({ message: "Not Found" });
});

const server = new ConvexHocuspocus({
  name: "summon-convex-documents",
  address: settings.CONVEX_LIVE_HOST,
  port: settings.CONVEX_LIVE_PORT,
  extensions: [convexDocuments(settings.CONVEX_URL)],
  debounce: 250,
  maxDebounce: 1000,
  onRequest({ request, response }) {
    app(request, response);
    // Hocuspocus 2.15 stops its default HTTP response on an empty rejection.
    return Promise.reject();
  },
});
await server.listen();
async function shutdown() {
  await server.destroy();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
