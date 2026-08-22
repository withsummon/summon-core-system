/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { OpportunitiesHeader } from "./opportunities-header";
import { PipelineStageFilter } from "./pipeline-stage-filter";
import { OpportunitiesListColumn } from "./opportunities-list-column";
import { OpportunityDetailPanel } from "./opportunity-detail-panel";
import { NewOpportunityModal } from "./new-opportunity-modal";
import { INITIAL_OPPORTUNITIES } from "./mock-data";
import type { IOpportunityItem, TPipelineStage } from "./types";

interface ISummonOpportunitiesRootViewProps {
  workspaceSlug: string;
  workspaceName?: string;
}

export const SummonOpportunitiesRootView: React.FC<ISummonOpportunitiesRootViewProps> = observer(
  function SummonOpportunitiesRootView({ workspaceSlug, workspaceName }) {
    const [opportunities, setOpportunities] = useState<IOpportunityItem[]>(INITIAL_OPPORTUNITIES);
    const [selectedStage, setSelectedStage] = useState<TPipelineStage>("All");
    const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(INITIAL_OPPORTUNITIES[0]?.id || "");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);

    // Calculate stage counts dynamically
    const stageCounts = useMemo(() => {
      const counts: Record<string, number> = {
        All: opportunities.length,
        Lead: 0,
        Qualified: 0,
        "POC / Discovery": 0,
        Proposal: 0,
        Negotiation: 0,
        "Closed Won": 0,
        "Closed Lost": 0,
      };

      opportunities.forEach((opp) => {
        if (counts[opp.stage] !== undefined) {
          counts[opp.stage]++;
        }
      });

      return counts as Record<TPipelineStage, number>;
    }, [opportunities]);

    // Filter opportunities by stage and search query
    const filteredOpportunities = useMemo(() => {
      return opportunities.filter((opp) => {
        if (selectedStage !== "All" && opp.stage !== selectedStage) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = opp.title.toLowerCase().includes(q);
          const matchClient = opp.client.toLowerCase().includes(q);
          const matchProduct = opp.about.product.toLowerCase().includes(q);
          if (!matchTitle && !matchClient && !matchProduct) {
            return false;
          }
        }

        return true;
      });
    }, [opportunities, selectedStage, searchQuery]);

    // Current selected opportunity object
    const selectedOpportunity = useMemo(() => {
      return opportunities.find((opp) => opp.id === selectedOpportunityId) || filteredOpportunities[0] || null;
    }, [opportunities, selectedOpportunityId, filteredOpportunities]);

    const handleCreateOpportunity = (newOpp: IOpportunityItem) => {
      setOpportunities((prev) => [newOpp, ...prev]);
      setSelectedOpportunityId(newOpp.id);
    };

    const handleUpdateStage = (newStage: TPipelineStage) => {
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === selectedOpportunityId
            ? {
                ...opp,
                stage: newStage,
                stageBadgeText: newStage === "POC / Discovery" ? "POC" : newStage,
              }
            : opp
        )
      );
    };

    const handleToggleFavorite = (id: string) => {
      setOpportunities((prev) => prev.map((opp) => (opp.id === id ? { ...opp, isFavorite: !opp.isFavorite } : opp)));
      setToast({
        type: TOAST_TYPE.INFO,
        title: "Favorites",
        message: "Favorites list updated.",
      });
    };

    return (
      <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
        <PageHead title={workspaceName ? `${workspaceName} - Opportunities` : "Opportunities"} />

        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-5 md:p-6 lg:p-7">
          {/* Header */}
          <OpportunitiesHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onToggleFilters={() => {
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Filters",
                message: "Filter options ready.",
              });
            }}
          />

          {/* 3-Column Split View */}
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
            {/* Left Stage Filter List (approx 15% / 2 cols) */}
            <div className="lg:col-span-2">
              <PipelineStageFilter
                selectedStage={selectedStage}
                onSelectStage={setSelectedStage}
                stageCounts={stageCounts}
              />
            </div>

            {/* Middle Opportunities List Column (approx 25% / 3 cols) */}
            <div className="lg:col-span-3">
              <OpportunitiesListColumn
                opportunities={filteredOpportunities}
                selectedOpportunityId={selectedOpportunity?.id || ""}
                onSelectOpportunity={setSelectedOpportunityId}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>

            {/* Right Opportunity Detail Panel (approx 60% / 7 cols) */}
            <div className="lg:col-span-7">
              <OpportunityDetailPanel
                opportunity={selectedOpportunity}
                onUpdateStage={handleUpdateStage}
                onToggleFavorite={() => selectedOpportunity && handleToggleFavorite(selectedOpportunity.id)}
              />
            </div>
          </div>
        </div>

        {/* Modal */}
        <NewOpportunityModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onCreateOpportunity={handleCreateOpportunity}
        />
      </div>
    );
  }
);
