import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(aggregate, { name: "taskCollection" });

export default app;
