/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import {
  Star,
  Pencil,
  MoreHorizontal,
  ChevronDown,
  Mail,
  MessageSquare,
  FileText,
  Video,
  CheckSquare,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  FileCode,
} from "lucide-react";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IOpportunityItem, TPipelineStage } from "./types";

interface IOpportunityDetailPanelProps {
  opportunity: IOpportunityItem | null;
  onUpdateStage?: (newStage: TPipelineStage) => void;
  onToggleFavorite?: () => void;
}

const TABS = ["Overview", "Activities", "Documents", "Tasks", "Meetings", "Notes", "Files"];

const getAssetIcon = (iconType: string) => {
  switch (iconType) {
    case "video":
      return { icon: Video, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" };
    case "checklist":
      return { icon: CheckSquare, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" };
    case "proposal":
      return { icon: FileCode, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" };
    case "doc":
    default:
      return { icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" };
  }
};

export const OpportunityDetailPanel: React.FC<IOpportunityDetailPanelProps> = ({
  opportunity,
  onUpdateStage,
  onToggleFavorite,
}) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [tasks, setTasks] = useState(opportunity?.nextSteps || []);

  if (!opportunity) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-subtle bg-surface-1 p-8 text-secondary text-xs">
        Select an opportunity from the list to view full details.
      </div>
    );
  }

  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleGenerate = (type: string) => {
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: `Generating ${type}`,
      message: `AI is preparing ${type} using context from ${opportunity.title}.`,
    });
  };

  const handleAssistantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantPrompt.trim()) return;
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Summon Assistant",
      message: `Processing "${assistantPrompt}" for ${opportunity.title}...`,
    });
    setAssistantPrompt("");
  };

  return (
    <div className="flex flex-col rounded-xl border border-subtle bg-surface-1 shadow-xs overflow-hidden h-full">
      {/* Top Banner Header */}
      <div className="border-b border-subtle p-5 bg-surface-2/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Avatar & Title */}
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-xs">
              {opportunity.initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-primary">{opportunity.title}</h1>
                <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  {opportunity.stageBadgeText}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">{opportunity.client}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleFavorite}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-amber-500 transition-colors shadow-2xs",
                opportunity.isFavorite && "text-amber-500"
              )}
            >
              <Star size={14} className={opportunity.isFavorite ? "fill-amber-500" : ""} />
            </button>

            <button
              type="button"
              onClick={() =>
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Edit Opportunity",
                  message: "Opening edit modal.",
                })
              }
              className="flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
            >
              <Pencil size={14} />
            </button>

            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-secondary hover:text-primary transition-colors shadow-2xs"
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Update Stage Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsStageMenuOpen(!isStageMenuOpen)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                <span>Update Stage</span>
                <ChevronDown size={13} />
              </button>

              {isStageMenuOpen && (
                <div className="absolute right-0 z-40 mt-1 w-44 rounded-lg border border-subtle bg-surface-1 py-1 shadow-lg text-left">
                  {["Lead", "Qualified", "POC / Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(
                    (stg) => (
                      <button
                        key={stg}
                        type="button"
                        onClick={() => {
                          onUpdateStage?.(stg as TPipelineStage);
                          setIsStageMenuOpen(false);
                          setToast({
                            type: TOAST_TYPE.SUCCESS,
                            title: "Stage Updated",
                            message: `Moved to ${stg}.`,
                          });
                        }}
                        className="flex w-full items-center px-3 py-1.5 text-xs text-primary hover:bg-surface-2 transition-colors"
                      >
                        <span>{stg}</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Key Metrics Row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 border-t border-subtle pt-3 text-xs">
          <div>
            <span className="text-[10px] text-secondary">Stage</span>
            <div className="mt-0.5 flex items-center gap-1.5 font-medium text-primary">
              <span className="size-2 rounded-full bg-purple-500" />
              <span>{opportunity.stage}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-secondary">Opportunity Value</span>
            <p className="mt-0.5 font-bold text-primary">{opportunity.value}</p>
          </div>

          <div>
            <span className="text-[10px] text-secondary">Probability</span>
            <p className="mt-0.5 font-semibold text-blue-600 dark:text-blue-400">
              {opportunity.probability}%
            </p>
          </div>

          <div>
            <span className="text-[10px] text-secondary">Expected Close</span>
            <p className="mt-0.5 font-medium text-primary">{opportunity.expectedClose}</p>
          </div>

          <div>
            <span className="text-[10px] text-secondary">Owner</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              {opportunity.owner.avatar ? (
                <img
                  src={opportunity.owner.avatar}
                  alt={opportunity.owner.name}
                  className="size-4.5 rounded-full object-cover"
                />
              ) : null}
              <span className="font-medium text-primary truncate">{opportunity.owner.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-subtle px-5 bg-surface-1 overflow-x-auto hide-horizontal-scrollbar">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-secondary hover:text-primary"
                )}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Subgrid */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Sub-column (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* About Opportunity */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary">About Opportunity</h3>
              <p className="text-xs leading-relaxed text-secondary">{opportunity.about.description}</p>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 rounded-xl border border-subtle bg-surface-2/40 p-3 text-xs">
                <div>
                  <span className="text-[10px] text-secondary">Solution</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.solution}</p>
                </div>
                <div>
                  <span className="text-[10px] text-secondary">Product</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.product}</p>
                </div>
                <div>
                  <span className="text-[10px] text-secondary">PIC Client</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.picClient}</p>
                </div>
                <div>
                  <span className="text-[10px] text-secondary">Department</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.department}</p>
                </div>
                <div>
                  <span className="text-[10px] text-secondary">Created</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.createdDate}</p>
                </div>
                <div>
                  <span className="text-[10px] text-secondary">Source</span>
                  <p className="font-medium text-primary mt-0.5">{opportunity.about.source}</p>
                </div>
              </div>
            </div>

            {/* Stage Progress Horizontal Stepper */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-primary">Stage Progress</h3>
              <div className="relative flex items-center justify-between rounded-xl border border-subtle bg-surface-2/30 p-3 overflow-x-auto hide-horizontal-scrollbar">
                {opportunity.stageProgress.map((step, idx) => {
                  const isCompleted = step.status === "completed";
                  const isCurrent = step.status === "current";

                  return (
                    <div key={step.stage} className="flex flex-col items-center text-center min-w-[70px] relative z-10">
                      {/* Circle Indicator */}
                      <div
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                          isCompleted
                            ? "bg-blue-600 text-white"
                            : isCurrent
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950"
                            : "bg-layer-2 text-secondary border border-subtle"
                        )}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>

                      {/* Step Name */}
                      <span
                        className={cn(
                          "mt-1.5 text-[10px] whitespace-nowrap",
                          isCurrent
                            ? "font-bold text-blue-600 dark:text-blue-400"
                            : "font-medium text-secondary"
                        )}
                      >
                        {step.stage}
                      </span>
                      {step.date && (
                        <span className="text-[9px] text-placeholder">{step.date}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Related Assets */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-primary">Related Assets</h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  <span>View all assets</span>
                  <ArrowRight size={11} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {opportunity.relatedAssets.map((asset) => {
                  const { icon: IconComp, color, bg } = getAssetIcon(asset.iconType);

                  return (
                    <div
                      key={asset.id}
                      onClick={() =>
                        setToast({
                          type: TOAST_TYPE.INFO,
                          title: "Asset Selected",
                          message: `Opening ${asset.title}.`,
                        })
                      }
                      className="group flex flex-col justify-between rounded-xl border border-subtle bg-surface-1 p-3 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className={cn("flex size-7 items-center justify-center rounded-lg border mb-2", bg, color)}>
                        <IconComp size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-primary group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                          {asset.title}
                        </p>
                        <p className="text-[10px] text-secondary mt-0.5">{asset.type}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sub-column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Next Steps (Tasks) */}
            <div className="rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-primary">Next Steps</h3>
                <button
                  type="button"
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  See all tasks →
                </button>
              </div>

              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className="flex items-center justify-between gap-2 rounded-lg p-1.5 hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {task.completed ? (
                        <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                      ) : (
                        <Circle size={14} className="text-placeholder shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          task.completed ? "line-through text-placeholder" : "text-primary"
                        )}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-medium",
                          task.dueBadgeType === "today"
                            ? "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:border-red-800"
                            : "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                        )}
                      >
                        {task.dueDate}
                      </span>
                      <img
                        src={task.assignee.avatar}
                        alt={task.assignee.name}
                        className="size-5 rounded-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setToast({
                    type: TOAST_TYPE.INFO,
                    title: "Add Task",
                    message: "Create next step task for this deal.",
                  })
                }
                className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
              >
                <Plus size={13} />
                <span>Add new task</span>
              </button>
            </div>

            {/* Key Contacts */}
            <div className="rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-primary">Key Contacts</h3>
                <button
                  type="button"
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  See all →
                </button>
              </div>

              <div className="space-y-2.5">
                {opportunity.keyContacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="size-7 rounded-full object-cover ring-1 ring-subtle shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-primary truncate">{contact.name}</p>
                        <p className="text-[10px] text-secondary truncate">{contact.role}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setToast({
                            type: TOAST_TYPE.INFO,
                            title: "Email Contact",
                            message: `Opening email to ${contact.email}`,
                          })
                        }
                        className="rounded p-1 text-placeholder hover:bg-surface-2 hover:text-primary transition-colors"
                      >
                        <Mail size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setToast({
                            type: TOAST_TYPE.INFO,
                            title: "Message",
                            message: `Opening chat with ${contact.name}`,
                          })
                        }
                        className="rounded p-1 text-placeholder hover:bg-surface-2 hover:text-primary transition-colors"
                      >
                        <MessageSquare size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-subtle bg-surface-1 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-primary">Recent Activity</h3>
                <button
                  type="button"
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  See all →
                </button>
              </div>

              <div className="space-y-3">
                {opportunity.recentActivity.map((act) => (
                  <div key={act.id} className="flex items-start gap-2.5 pl-0.5">
                    <span
                      className={cn(
                        "mt-1 size-2 rounded-full shrink-0",
                        act.color === "blue"
                          ? "bg-blue-500"
                          : act.color === "purple"
                          ? "bg-purple-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-primary truncate">{act.title}</p>
                      <p className="text-[10px] text-secondary mt-0.5">
                        {act.author} • {act.timeAgo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating AI Action Bar */}
      <div className="border-t border-subtle p-3.5 bg-surface-2/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left AI Question Input */}
        <form onSubmit={handleAssistantSubmit} className="relative flex-1 w-full flex items-center">
          <Sparkles size={14} className="absolute left-3 text-blue-600 dark:text-blue-400" />
          <input
            type="text"
            placeholder="Ask Summon Assistant about this opportunity..."
            value={assistantPrompt}
            onChange={(e) => setAssistantPrompt(e.target.value)}
            className="w-full rounded-lg border border-subtle bg-surface-1 py-1.5 pl-8 pr-3 text-xs text-primary placeholder:text-placeholder focus:border-blue-500 focus:outline-none"
          />
        </form>

        {/* Right AI Quick Actions Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleGenerate("Proposal")}
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-3 transition-colors shadow-2xs"
          >
            <Sparkles size={12} className="text-blue-600" />
            <span>Generate Proposal</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerate("MoM")}
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-3 transition-colors shadow-2xs"
          >
            <Sparkles size={12} className="text-purple-600" />
            <span>Generate MoM</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerate("PPT Presentation")}
            className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-3 transition-colors shadow-2xs"
          >
            <Sparkles size={12} className="text-orange-600" />
            <span>Generate PPT</span>
          </button>

          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-lg border border-subtle bg-surface-1 text-placeholder hover:text-primary transition-colors"
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
