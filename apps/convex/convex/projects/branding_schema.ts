import { ConvexError, v, type Infer } from "convex/values";
import { z } from "zod/v4";
import { boundedJson } from "../../shared/json";

export const projectLogoProps = v.record(v.string(), v.any());
export type ProjectLogoProps = Infer<typeof projectLogoProps>;

const logoSchema = z.union([
  z.looseObject({
    in_use: z.enum(["emoji", "icon"]),
    emoji: z.looseObject({ value: z.string().optional(), url: z.string().optional() }).optional(),
    icon: z
      .looseObject({
        name: z.string().optional(),
        color: z.string().optional(),
        background_color: z.string().optional(),
      })
      .optional(),
  }),
  z.looseObject({ in_use: z.null().default(null) }),
]);

export function validatedProjectLogo(props: ProjectLogoProps) {
  boundedJson(props, "Project logo properties", 10000);
  const parsed = logoSchema.safeParse(props);
  if (!parsed.success) throw new ConvexError("Choose valid emoji or icon properties for the project logo.");
  return parsed.data;
}

/** Preserve opaque legacy JSON, but expose only the renderer's validated fields. */
export function renderedProjectLogo(props: ProjectLogoProps) {
  const parsed = validatedProjectLogo(props);
  if (parsed.in_use === null) return null;
  const { in_use, emoji, icon } = parsed;
  return {
    in_use,
    ...(emoji === undefined ? {} : { emoji: { value: emoji.value, url: emoji.url } }),
    ...(icon === undefined
      ? {}
      : { icon: { name: icon.name, color: icon.color, background_color: icon.background_color } }),
  };
}
