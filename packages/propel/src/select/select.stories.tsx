/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MultiSelect, Select } from "./root";

const stages = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Closed won", disabled: true },
];

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { options: stages, placeholder: "Select a stage" },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render(args) {
    const [value, setValue] = useState("lead");
    return (
      <div className="grid w-64 gap-1.5 text-12 text-secondary">
        <span id="story-label-1">Stage</span>
        <Select aria-labelledby="story-label-1" {...args} value={value} onValueChange={setValue} />
      </div>
    );
  },
};

export const Multiple: Story = {
  render() {
    const [values, setValues] = useState<string[]>(["lead"]);
    return (
      <div className="grid w-64 gap-1.5 text-12 text-secondary">
        <span id="story-label-2">Stages</span>
        <MultiSelect aria-labelledby="story-label-2" options={stages} value={values} onValueChange={setValues} />
      </div>
    );
  },
};
