import { v, type Infer } from "convex/values";
export const projectTab = v.union(
  v.literal("work_items"),
  v.literal("cycles"),
  v.literal("modules"),
  v.literal("views"),
  v.literal("pages"),
  v.literal("intake"),
  v.literal("overview")
);
export const projectNavigation = v.object({ defaultTab: projectTab, hiddenTabs: v.array(projectTab) });
export const defaultProjectNavigation: Infer<typeof projectNavigation> = { defaultTab: "work_items", hiddenTabs: [] };
export const projectTabs = {
  work_items: { key: "work_items", view: "tasks", label: "Tasks" },
  cycles: { key: "cycles", view: "cycles", label: "Cycles" },
  modules: { key: "modules", view: "modules", label: "Modules" },
  views: { key: "views", view: "views", label: "Views" },
  pages: { key: "pages", view: "pages", label: "Pages" },
  intake: { key: "intake", view: "intake", label: "Intake" },
  overview: { key: "overview", view: "overview", label: "Overview" },
} as const satisfies { [Tab in Infer<typeof projectTab>]: { key: Tab; view: string; label: string } };
