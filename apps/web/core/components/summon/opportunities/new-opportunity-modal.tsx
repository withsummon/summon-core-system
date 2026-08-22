/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IOpportunityItem, TPipelineStage } from "./types";

interface INewOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOpportunity: (opp: IOpportunityItem) => void;
}

export const NewOpportunityModal: React.FC<INewOpportunityModalProps> = ({ isOpen, onClose, onCreateOpportunity }) => {
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<TPipelineStage>("Lead");
  const [probability, setProbability] = useState("50");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newOpp: IOpportunityItem = {
      id: `opp-${Date.now()}`,
      title,
      client: client || "Enterprise Client",
      initials: title.slice(0, 2).toUpperCase(),
      avatarColor: "blue",
      stage,
      stageBadgeText: stage === "POC / Discovery" ? "POC" : stage,
      updatedAt: "Just now",
      value: value ? `IDR ${Number(value).toLocaleString("id-ID")}` : "IDR 250.000.000",
      probability: Number(probability) || 50,
      expectedClose: "31 Dec 2025",
      owner: {
        name: "You",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      },
      about: {
        description: description || `Opportunity details for ${title}.`,
        solution: "Enterprise AI Suite",
        product: "Summon Platform",
        picClient: "Client Stakeholder",
        department: "Strategy",
        createdDate: "Today",
        source: "Inbound",
      },
      stageProgress: [
        { stage: "Lead", date: "Today", status: "completed" },
        { stage: "Qualified", status: "upcoming" },
        { stage: "POC / Discovery", status: "upcoming" },
        { stage: "Proposal", status: "upcoming" },
        { stage: "Negotiation", status: "upcoming" },
        { stage: "Closed", status: "upcoming" },
      ],
      nextSteps: [],
      keyContacts: [],
      relatedAssets: [],
      recentActivity: [
        {
          id: `act-${Date.now()}`,
          title: "Opportunity created",
          author: "by You",
          timeAgo: "Just now",
          color: "blue",
        },
      ],
    };

    onCreateOpportunity(newOpp);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Opportunity Created",
      message: `${title} has been added to your pipeline.`,
    });
    onClose();
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs duration-200">
      <div
        className="shadow-2xl relative w-full max-w-lg overflow-hidden rounded-2xl border border-subtle bg-surface-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-subtle bg-surface-2/40 px-6 py-4">
          <h2 className="text-sm font-semibold text-primary">Create New Opportunity</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-placeholder transition-colors hover:bg-surface-2 hover:text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Opportunity Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. AI Interviewer Expansion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Client Name</label>
              <input
                type="text"
                placeholder="e.g. PT Pegadaian"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Value (IDR)</label>
              <input
                type="number"
                placeholder="450000000"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Pipeline Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as TPipelineStage)}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-primary focus:outline-none"
              >
                <option value="Lead">Lead</option>
                <option value="Qualified">Qualified</option>
                <option value="POC / Discovery">POC / Discovery</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-secondary">Win Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="text-xs focus:border-blue-500 w-full rounded-lg border border-subtle bg-surface-2 px-3 py-2 text-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-secondary">Description / Notes</label>
            <textarea
              rows={3}
              placeholder="Brief context and objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs focus:border-blue-500 w-full resize-none rounded-lg border border-subtle bg-surface-2 p-2.5 text-primary focus:outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-subtle pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-lg border border-subtle px-4 py-2 font-medium text-secondary transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-xs hover:bg-blue-700 shadow-xs rounded-lg px-4 py-2 font-semibold text-white transition-colors"
            >
              Create Opportunity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
