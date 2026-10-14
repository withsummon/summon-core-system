/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Plus, Link2 } from "lucide-react";
import type { ICreateResourcePayload } from "./types";
import { Input, TextArea } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";

interface IAddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: ICreateResourcePayload) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
}

export function AddResourceModal({ isOpen, onClose, onSave, projects }: IAddResourceModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("document");
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await onSave({
        title,
        url,
        category,
        project: project || undefined,
        description: description || undefined,
      });
      setTitle("");
      setUrl("");
      setDescription("");
      setProject("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to add resource. Please check the URL.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Panel width={EDialogWidth.LG} className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
              <Link2 className="size-5" />
            </div>
            <div>
              <Dialog.Title className="text-16 font-semibold text-primary">Add New Resource Link</Dialog.Title>
              <p className="text-xs text-secondary">Save an external link, document, or repository reference</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-10 place-items-center rounded-lg text-secondary hover:bg-layer-1 hover:text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-6">
          {error && (
            <div className="rounded-lg bg-danger-subtle p-2.5 text-xs font-semibold text-danger-primary">{error}</div>
          )}

          <div>
            <label htmlFor="resource-title" className="block text-xs font-semibold text-primary">
              Resource Title *
            </label>
            <Input
              id="resource-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Proposal - BSB v1.2.pdf"
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label htmlFor="resource-url" className="block text-xs font-semibold text-primary">
              External URL *
            </label>
            <Input
              id="resource-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="resource-category" className="block text-xs font-semibold text-primary">
                Category / Type
              </label>
              <Select
                id="resource-category"
                value={category}
                onValueChange={(value) => setCategory(value)}
                className="mt-1"
                options={[
                  { value: "document", label: "Document" },
                  { value: "repository", label: "Repository (GitHub/GitLab)" },
                  { value: "figma", label: "Figma Files" },
                  { value: "deployment", label: "Live Deployment" },
                  { value: "drive", label: "Google Drive" },
                  { value: "recording", label: "Video Recording" },
                  { value: "account", label: "Account / Credential" },
                ]}
              />
            </div>

            <div>
              <label htmlFor="resource-project" className="block text-xs font-semibold text-primary">
                Linked Project
              </label>
              <Select
                id="resource-project"
                value={project}
                onValueChange={(value) => setProject(value)}
                className="mt-1"
                options={[
                  { value: "", label: "No project (Global)" },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
          </div>

          <div>
            <label htmlFor="resource-description" className="block text-xs font-semibold text-primary">
              Description (Optional)
            </label>
            <TextArea
              id="resource-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context or notes about this resource…"
              className="mt-1"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-subtle pt-4">
            <Button type="button" variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" prependIcon={<Plus />} loading={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Resource"}
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
