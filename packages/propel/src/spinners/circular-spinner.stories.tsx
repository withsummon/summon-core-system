/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./circular-spinner";

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    height: "32px",
    width: "32px",
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: {
    height: "16px",
    width: "16px",
  },
};

export const Medium: Story = {
  args: {
    height: "24px",
    width: "24px",
  },
};

export const Large: Story = {
  args: {
    height: "48px",
    width: "48px",
  },
};

export const ExtraLarge: Story = {
  args: {
    height: "64px",
    width: "64px",
  },
};

export const CustomColor: Story = {
  args: {
    className: "text-accent-primary",
  },
};

export const AllSizes: Story = {
  render() {
    return (
      <div className="flex items-center gap-6">
        <div className="text-center">
          <Spinner height="16px" width="16px" />
          <p className="mt-2 text-11 text-secondary">Small</p>
        </div>
        <div className="text-center">
          <Spinner height="24px" width="24px" />
          <p className="mt-2 text-11 text-secondary">Medium</p>
        </div>
        <div className="text-center">
          <Spinner height="32px" width="32px" />
          <p className="mt-2 text-11 text-secondary">Default</p>
        </div>
        <div className="text-center">
          <Spinner height="48px" width="48px" />
          <p className="mt-2 text-11 text-secondary">Large</p>
        </div>
        <div className="text-center">
          <Spinner height="64px" width="64px" />
          <p className="mt-2 text-11 text-secondary">XL</p>
        </div>
      </div>
    );
  },
};

export const ColorVariations: Story = {
  render() {
    return (
      <div className="flex items-center gap-6">
        <div className="text-center">
          <Spinner className="text-accent-primary" />
          <p className="mt-2 text-11 text-secondary">Blue</p>
        </div>
        <div className="text-center">
          <Spinner className="text-success-primary" />
          <p className="mt-2 text-11 text-secondary">Green</p>
        </div>
        <div className="text-center">
          <Spinner className="text-danger-primary" />
          <p className="mt-2 text-11 text-secondary">Red</p>
        </div>
        <div className="text-center">
          <Spinner className="text-label-purple-icon" />
          <p className="mt-2 text-11 text-secondary">Purple</p>
        </div>
        <div className="text-center">
          <Spinner className="text-label-orange-icon" />
          <p className="mt-2 text-11 text-secondary">Orange</p>
        </div>
      </div>
    );
  },
};

export const InButton: Story = {
  render() {
    return (
      <button className="flex items-center gap-2 rounded-sm bg-accent-primary px-4 py-2 text-on-color">
        <Spinner height="16px" width="16px" />
        <span>Loading…</span>
      </button>
    );
  },
};

export const CenteredInCard: Story = {
  render() {
    return (
      <div className="w-96 rounded-lg border border-subtle bg-white p-8 shadow-md">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Spinner height="48px" width="48px" />
          <p className="text-13 text-secondary">Loading content…</p>
        </div>
      </div>
    );
  },
};
