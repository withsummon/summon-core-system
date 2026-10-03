import { v } from "convex/values";
export const projectFeatures = v.object({
  cycles: v.boolean(),
  modules: v.boolean(),
  views: v.boolean(),
  pages: v.boolean(),
});
export const defaultProjectFeatures = { cycles: false, modules: false, views: false, pages: true };
