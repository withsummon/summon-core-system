/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Popover } from "./popover";

const meta: Meta<typeof Popover> = {
  title: "Popover",
  component: Popover,
};

export default meta;

// types
type Story = StoryObj<typeof Popover>;

// data

// components
const RenderCustomPopoverComponent = (
  <div className="space-y-2">
    <div className="text-13 font-medium text-secondary">Your custom component</div>
    <div>
      {["option1", "option2", "option3"].map((option) => (
        <div
          key={option}
          className="cursor-pointer rounded-xs px-1.5 py-0.5 text-13 text-secondary capitalize transition-colors hover:bg-layer-1-hover hover:text-primary"
        >
          {option}
        </div>
      ))}
    </div>
  </div>
);

// stories
export const Default: Story = {
  args: {
    popperPosition: "bottom-start",
    panelClassName: "rounded-sm bg-layer-1 p-2",
    children: RenderCustomPopoverComponent,
  },
};

export const CustomMenuButton: Story = {
  args: {
    popperPosition: "bottom-start",
    button: (
      <div className="rounded-sm bg-layer-1 p-2 text-13 font-medium transition-colors hover:bg-layer-1-hover">
        Custom Menu Button
      </div>
    ),
    panelClassName: "rounded-sm bg-layer-1 p-2",
    children: RenderCustomPopoverComponent,
  },
};
