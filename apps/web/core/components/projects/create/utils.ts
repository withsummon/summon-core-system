/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { RANDOM_EMOJI_CODES } from "@plane/constants";
import type { IProject } from "@plane/types";
import type { FunctionArgs } from "convex/server";
import type { ComponentProps } from "react";
import type { Logo } from "@plane/propel/emoji-icon-picker";
import type { api } from "@summon/convex/api";
import { getRandomCoverImage } from "@/helpers/cover-image.helper";

function projectCreationDefaults() {
  return {
    description: "",
    logoProps: {
      in_use: "emoji",
      emoji: { value: RANDOM_EMOJI_CODES[Math.floor(Math.random() * RANDOM_EMOJI_CODES.length)] },
    } satisfies NonNullable<ComponentProps<typeof Logo>["logo"]>,
    identifier: "",
    name: "",
    network: 2,
    leadId: null,
  } satisfies Omit<FunctionArgs<typeof api.projects.index.create>, "workspaceId">;
}

export const getProjectFormValues = (): Partial<IProject> => {
  const { logoProps, leadId, ...fields } = projectCreationDefaults();
  return { ...fields, cover_image_url: getRandomCoverImage(), logo_props: logoProps, project_lead: leadId };
};

export function getNativeProjectFormValues(workspaceId: FunctionArgs<typeof api.projects.index.create>["workspaceId"]) {
  return { workspaceId, ...projectCreationDefaults() } satisfies FunctionArgs<typeof api.projects.index.create>;
}
