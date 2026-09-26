/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "./root";

const meta: Meta<typeof DatePicker> = {
  title: "Components/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  render(args) {
    const [value, setValue] = useState("");
    return (
      <div className="grid w-64 gap-1.5 text-12 text-secondary">
        <span id="story-label-1">Expected close</span>
        <DatePicker aria-labelledby="story-label-1" {...args} value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const WithRange: Story = {
  args: { min: "2026-09-01", max: "2026-09-30", defaultValue: "2026-09-15" },
  render(args) {
    return (
      <div className="grid w-64 gap-1.5 text-12 text-secondary">
        <span id="story-label-2">September only</span>
        <DatePicker aria-labelledby="story-label-2" {...args} />
      </div>
    );
  },
};
