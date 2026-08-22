/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { KnowledgeHeader } from "./knowledge-header";
import { AskAssistantCard } from "./ask-assistant-card";
import { BrowseContextsRow } from "./browse-contexts-row";
import { RecentKnowledgeTable } from "./recent-knowledge-table";
import { QuickActionsCard } from "./quick-actions-card";
import { RecentNotesCard } from "./recent-notes-card";
import { PopularKnowledgeCard } from "./popular-knowledge-card";
import { KnowledgeStatsCard } from "./knowledge-stats-card";
import { KnowledgeDetailModal } from "./knowledge-detail-modal";
import { INITIAL_KNOWLEDGE_ITEMS } from "./mock-data";
import type { IKnowledgeItem, IPopularKnowledgeItem, IRecentNote, TContextCategory } from "./types";

interface IKnowledgeRootViewProps {
  workspaceSlug: string;
  workspaceName?: string;
}

export const KnowledgeRootView: React.FC<IKnowledgeRootViewProps> = observer(function KnowledgeRootView({
  workspaceSlug,
  workspaceName,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContext, setSelectedContext] = useState<string | undefined>(undefined);
  const [knowledgeItems, setKnowledgeItems] = useState<IKnowledgeItem[]>(INITIAL_KNOWLEDGE_ITEMS);
  const [selectedItem, setSelectedItem] = useState<IKnowledgeItem | null>(null);

  // Filter items by search query and context
  const filteredKnowledgeItems = useMemo(() => {
    return knowledgeItems.filter((item) => {
      if (selectedContext) {
        if (
          selectedContext === "Projects" &&
          !item.context.toLowerCase().includes("system") &&
          !item.context.toLowerCase().includes("enhancement") &&
          item.context !== "AURA"
        ) {
          return false;
        }
        if (selectedContext === "Company" && item.context !== "Company") {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchContext = item.context.toLowerCase().includes(q);
        const matchAuthor = item.updatedBy.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchContext && !matchAuthor) {
          return false;
        }
      }

      return true;
    });
  }, [knowledgeItems, selectedContext, searchQuery]);

  const handleSelectContext = (ctx: TContextCategory) => {
    if (selectedContext === ctx) {
      setSelectedContext(undefined);
      setToast({
        type: TOAST_TYPE.INFO,
        title: "Filter Cleared",
        message: "Showing all contexts.",
      });
    } else {
      setSelectedContext(ctx);
      setToast({
        type: TOAST_TYPE.INFO,
        title: "Context Filter",
        message: `Filtered knowledge by "${ctx}".`,
      });
    }
  };

  const handleSelectNote = (note: IRecentNote) => {
    const matchingItem = knowledgeItems.find((k) =>
      k.title.toLowerCase().includes(note.title.toLowerCase().slice(0, 10))
    );
    if (matchingItem) {
      setSelectedItem(matchingItem);
    } else {
      setSelectedItem({
        id: note.id,
        title: note.title,
        description: `Notes taken during ${note.title.toLowerCase()}.`,
        context: "Meeting Notes",
        type: "Note",
        updatedAt: note.timeAgo,
        updatedBy: {
          name: "You",
          initials: "ME",
        },
        content: `# ${note.title}\n\n**Created:** ${note.timeAgo}\n\n### Summary\nNotes and action items recorded during this discussion.\n\n- Reviewed project scope and technical requirements.\n- Aligned on immediate deliverables for the upcoming sprint.`,
      });
    }
  };

  const handleSelectPopular = (popular: IPopularKnowledgeItem) => {
    const matchingItem = knowledgeItems.find((k) =>
      k.title.toLowerCase().includes(popular.title.toLowerCase().slice(0, 10))
    );
    if (matchingItem) {
      setSelectedItem(matchingItem);
    } else {
      setSelectedItem({
        id: popular.id,
        title: popular.title,
        description: `Popular documentation for ${popular.title}.`,
        context: "Engineering Guidelines",
        type: "Document",
        updatedAt: "Recently",
        updatedBy: {
          name: "Engineering Team",
          initials: "ET",
        },
        views: popular.views,
        content: `# ${popular.title}\n\n**Total Views:** ${popular.views}\n\n## Overview\nThis is one of the most frequently accessed knowledge assets across the workspace.`,
      });
    }
  };

  const handleDeleteItem = (id: string) => {
    setKnowledgeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreateNote = () => {
    const newNote: IKnowledgeItem = {
      id: `kn-${Date.now()}`,
      title: "New Quick Note",
      description: "Draft quick note created from Knowledge hub.",
      context: "Workspace",
      type: "Note",
      updatedAt: "Just now",
      updatedBy: {
        name: "You",
        initials: "ME",
      },
      content: "# New Quick Note\n\nStart typing your note here...",
    };
    setKnowledgeItems((prev) => [newNote, ...prev]);
    setSelectedItem(newNote);
    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Note Created",
      message: "New note added to your knowledge base.",
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
      <PageHead title={workspaceName ? `${workspaceName} - Knowledge` : "Knowledge"} />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 p-5 md:p-6 lg:p-7">
        {/* Top Header & Search Bar */}
        <KnowledgeHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenQuickFind={() => {
            const searchInput = document.querySelector("input[placeholder*='Search knowledge']");
            if (searchInput instanceof HTMLInputElement) searchInput.focus();
          }}
        />

        {/* 2-Column Main Dashboard */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Main Column (approx 70% / 8 cols) */}
          <div className="space-y-5 lg:col-span-8">
            {/* 1. Ask Summon Assistant Banner */}
            <AskAssistantCard
              onAskQuestion={(q) => {
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Summon Assistant",
                  message: `Synthesizing answer from knowledge base for "${q}"...`,
                });
              }}
            />

            {/* 2. Browse by Context 5 Cards */}
            <BrowseContextsRow
              selectedContext={selectedContext}
              onSelectContext={handleSelectContext}
              onViewAllContexts={() => {
                setSelectedContext(undefined);
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "All Contexts",
                  message: "Showing knowledge across all contexts.",
                });
              }}
            />

            {/* 3. Recent Knowledge Table with Tabs & Pagination */}
            <RecentKnowledgeTable
              items={filteredKnowledgeItems}
              onSelectItem={(item) => setSelectedItem(item)}
              onViewAllKnowledge={() => {
                setSearchQuery("");
                setSelectedContext(undefined);
              }}
              onDeleteItem={handleDeleteItem}
            />
          </div>

          {/* Right Sidebar Column (approx 30% / 4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            {/* 1. Quick Actions */}
            <QuickActionsCard
              onCreateNote={handleCreateNote}
              onUploadDocument={() => {
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Upload Document",
                  message: "Select a PDF or DOCX file to upload.",
                });
              }}
              onCreateFromUrl={() => {
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Ingest URL",
                  message: "Webpage scraper ready for URL input.",
                });
              }}
              onAskAssistant={() => {
                const el = document.querySelector("input[placeholder*='Ask a question']");
                if (el instanceof HTMLInputElement) {
                  el.focus();
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            />

            {/* 2. Recent Notes */}
            <RecentNotesCard
              onSelectNote={handleSelectNote}
              onViewAllNotes={() => {
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Recent Notes",
                  message: "Viewing all recent workspace notes.",
                });
              }}
            />

            {/* 3. Popular Knowledge */}
            <PopularKnowledgeCard
              onSelectItem={handleSelectPopular}
              onViewAllPopular={() => {
                setToast({
                  type: TOAST_TYPE.INFO,
                  title: "Popular Knowledge",
                  message: "Viewing trending knowledge articles.",
                });
              }}
            />

            {/* 4. Knowledge Stats */}
            <KnowledgeStatsCard />
          </div>
        </div>
      </div>

      {/* Item Detail Modal */}
      <KnowledgeDetailModal item={selectedItem} isOpen={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} />
    </div>
  );
});
