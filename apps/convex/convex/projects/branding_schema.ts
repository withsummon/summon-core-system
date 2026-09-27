import { ConvexError, v, type Infer } from "convex/values";
import { boundedJson } from "../../shared/json";

export const projectLogoProps = v.record(v.string(), v.any());
export type ProjectLogoProps = Infer<typeof projectLogoProps>;

function optionalString(value: unknown, field: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ConvexError(`Project logo ${field} must be text.`);
  return value;
}

function objectField(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new ConvexError(`Project logo ${field} must be an object.`);
  return Object.fromEntries(Object.entries(value));
}

/** Preserve opaque legacy JSON, but expose only the renderer's validated fields. */
export function renderedProjectLogo(props: ProjectLogoProps) {
  boundedJson(props, "Project logo properties", 10000);
  if (props.in_use === undefined) return null;
  if (props.in_use !== "emoji" && props.in_use !== "icon")
    throw new ConvexError("Choose an emoji or icon for the project logo.");
  const in_use: "emoji" | "icon" = props.in_use;
  const emoji = objectField(props.emoji, "emoji");
  const icon = objectField(props.icon, "icon");
  return {
    in_use,
    ...(emoji === undefined
      ? {}
      : {
          emoji: {
            value: optionalString(emoji.value, "emoji value"),
            url: optionalString(emoji.url, "emoji URL"),
          },
        }),
    ...(icon === undefined
      ? {}
      : {
          icon: {
            name: optionalString(icon.name, "icon name"),
            color: optionalString(icon.color, "icon color"),
            background_color: optionalString(icon.background_color, "icon background color"),
          },
        }),
  };
}
