/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Plus, Link2 } from "lucide-react";
import type { ICreateResourcePayload } from "./types";
import type { Id } from "@summon/convex/data-model";
import { selectedAssociation } from "@/components/convex-core/resources/associations";
import { summonErrorMessage } from "@/components/summon/screen";
import { Select } from "@plane/propel/select";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";

interface IAddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: ICreateResourcePayload) => Promise<void>;
  projects: Array<{ id: Id<"projects">; name: string }>;
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
        projectId: selectedAssociation(project, projects),
        documentId: null,
        clientId: null,
        credentialId: null,
        description,
      });
      setTitle("");
      setUrl("");
      setDescription("");
      setProject("");
      onClose();
    } catch (err) {
      setError(summonErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Panel
        width={EDialogWidth.LG}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
              <Link2 className="size-5" />
            </div>
            <div>
              <Dialog.Title className="text-16 font-bold text-primary">Add New Resource Link</Dialog.Title>
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
            <div className="bg-red-500/10 text-xs text-red-600 dark:text-red-400 rounded-lg p-2.5 font-semibold">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="resource-title" className="text-xs block font-semibold text-primary">
              Resource Title *
            </label>
            <input
              id="resource-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Proposal - BSB v1.2.pdf"
              className="focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-12 text-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="resource-url" className="text-xs block font-semibold text-primary">
              External URL *
            </label>
            <input
              id="resource-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-12 text-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="resource-category" className="text-xs block font-semibold text-primary">
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
              <label htmlFor="resource-project" className="text-xs block font-semibold text-primary">
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
            <label htmlFor="resource-description" className="text-xs block font-semibold text-primary">
              Description (Optional)
            </label>
            <textarea
              id="resource-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context or notes about this resource..."
              className="focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-12 text-primary focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-subtle pt-4">
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-lg border border-subtle bg-surface-1 px-4 py-2 font-semibold text-secondary hover:bg-layer-1 hover:text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs shadow-sm flex items-center gap-1.5 rounded-lg bg-accent-primary px-5 py-2 font-bold text-white hover:bg-accent-primary/90 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              {isSubmitting ? "Saving..." : "Save Resource"}
            </button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
