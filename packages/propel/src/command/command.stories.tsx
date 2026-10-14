/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { File, Folder, Settings, User } from "lucide-react";
import { Command } from "./command";

const meta = {
  title: "Components/Command",
  component: Command,
  subcomponents: {
    CommandInput: Command.Input,
    CommandList: Command.List,
    CommandItem: Command.Item,
    CommandEmpty: Command.Empty,
  },
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input placeholder="Search…" className="h-9 w-full bg-transparent py-3 text-13 outline-none" />
        <Command.List className="max-h-80 overflow-auto py-2">
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">Item 1</Command.Item>
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">Item 2</Command.Item>
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">Item 3</Command.Item>
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">No results found.</Command.Empty>
      </Command>
    );
  },
};

export const WithIcons: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input
          placeholder="Search files and folders…"
          className="h-9 w-full bg-transparent py-3 text-13 outline-none"
        />
        <Command.List className="max-h-80 overflow-auto py-2">
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Folder className="h-4 w-4" />
            <span>Documents</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Folder className="h-4 w-4" />
            <span>Downloads</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <File className="h-4 w-4" />
            <span>README.md</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <File className="h-4 w-4" />
            <span>package.json</span>
          </Command.Item>
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">No files or folders found.</Command.Empty>
      </Command>
    );
  },
};

export const WithCategories: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input placeholder="Search commands…" className="h-9 w-full bg-transparent py-3 text-13 outline-none" />
        <Command.List className="max-h-80 overflow-auto py-2">
          <div className="px-2 py-1.5 text-11 font-semibold text-secondary">User</div>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Command.Item>

          <div className="mt-2 px-2 py-1.5 text-11 font-semibold text-secondary">Files</div>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Folder className="h-4 w-4" />
            <span>Open Folder</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <File className="h-4 w-4" />
            <span>New File</span>
          </Command.Item>
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">No commands found.</Command.Empty>
      </Command>
    );
  },
};

export const EmptyState: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input placeholder="Search…" className="h-9 w-full bg-transparent py-3 text-13 outline-none" />
        <Command.List className="max-h-80 overflow-auto py-2">{/* No items - will show empty state */}</Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">
          <p className="font-semibold">No results found</p>
          <p className="mt-1 text-11">Try searching for something else</p>
        </Command.Empty>
      </Command>
    );
  },
};

export const LongList: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input placeholder="Search items…" className="h-9 w-full bg-transparent py-3 text-13 outline-none" />
        <Command.List className="max-h-60 overflow-auto py-2">
          {Array.from({ length: 20 }, (_, i) => (
            <Command.Item key={i} className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">
              Item {i + 1}
            </Command.Item>
          ))}
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">No results found.</Command.Empty>
      </Command>
    );
  },
};

export const WithoutSearch: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.List className="max-h-80 overflow-auto py-2">
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Command.Item>
          <Command.Item className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            <Folder className="h-4 w-4" />
            <span>Files</span>
          </Command.Item>
        </Command.List>
      </Command>
    );
  },
};

export const CustomStyling: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border-2 border-accent-subtle bg-accent-subtle p-2 shadow-lg">
        <Command.Input
          placeholder="Search with custom styling…"
          className="h-9 w-full bg-transparent py-3 text-13 text-accent-primary outline-none placeholder:text-accent-secondary"
        />
        <Command.List className="max-h-80 overflow-auto py-2">
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 text-accent-primary hover:bg-accent-subtle-hover">
            Custom Item 1
          </Command.Item>
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 text-accent-primary hover:bg-accent-subtle-hover">
            Custom Item 2
          </Command.Item>
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 text-accent-primary hover:bg-accent-subtle-hover">
            Custom Item 3
          </Command.Item>
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-accent-primary">No matching items found.</Command.Empty>
      </Command>
    );
  },
};

export const DisabledItems: Story = {
  render() {
    return (
      <Command className="w-96 rounded-lg border border-subtle p-2">
        <Command.Input placeholder="Search…" className="h-9 w-full bg-transparent py-3 text-13 outline-none" />
        <Command.List className="max-h-80 overflow-auto py-2">
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            Active Item 1
          </Command.Item>
          <Command.Item disabled className="cursor-not-allowed rounded-sm px-3 py-2 opacity-50">
            Disabled Item
          </Command.Item>
          <Command.Item className="cursor-pointer rounded-sm px-3 py-2 hover:bg-layer-1-hover">
            Active Item 2
          </Command.Item>
        </Command.List>
        <Command.Empty className="py-6 text-center text-13 text-secondary">No results found.</Command.Empty>
      </Command>
    );
  },
};
