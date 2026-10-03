import { convexDocuments } from "./convex/documents";
import { ConvexHocuspocus } from "./convex/server";

const url = process.env.CONVEX_URL;
if (!url) throw new Error("CONVEX_URL is required for the Convex collaboration server.");
const port = Number(process.env.CONVEX_LIVE_PORT ?? "1235");
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("CONVEX_LIVE_PORT must be a valid port.");

const server = new ConvexHocuspocus({
  name: "summon-convex-documents",
  address: process.env.CONVEX_LIVE_HOST ?? "0.0.0.0",
  port,
  extensions: [convexDocuments(url)],
  debounce: 250,
  maxDebounce: 1000,
});
await server.listen();
async function shutdown() {
  await server.destroy();
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
