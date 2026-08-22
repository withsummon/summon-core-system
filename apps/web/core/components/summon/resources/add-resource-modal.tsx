/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Plus, Link2 } from "lucide-react";
import type { ICreateResourcePayload } from "./types";

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="shadow-2xl flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
              <Link2 className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">Add New Resource Link</h2>
              <p className="text-xs text-secondary">Save an external link, document, or repository reference</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:bg-layer-1 hover:text-primary"
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
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
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
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="resource-category" className="text-xs block font-semibold text-primary">
                Category / Type
              </label>
              <select
                id="resource-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              >
                <option value="document">Document</option>
                <option value="repository">Repository (GitHub/GitLab)</option>
                <option value="figma">Figma Files</option>
                <option value="deployment">Live Deployment</option>
                <option value="drive">Google Drive</option>
                <option value="recording">Video Recording</option>
                <option value="account">Account / Credential</option>
              </select>
            </div>

            <div>
              <label htmlFor="resource-project" className="text-xs block font-semibold text-primary">
                Linked Project
              </label>
              <select
                id="resource-project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
              >
                <option value="">No project (Global)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
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
              className="text-xs focus:border-accent-primary mt-1 w-full rounded-lg border border-subtle bg-layer-1 p-2 text-primary focus:outline-none"
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
      </div>
    </div>
  );
}
