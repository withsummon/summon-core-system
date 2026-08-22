/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { PageHead } from "@/components/core/page-title";
import { TopTemplatesRow } from "./top-templates-row";
import { AIGeneratorForm } from "./ai-generator-form";
import { GeneratedDocumentsTable } from "./generated-documents-table";
import { TemplateLibraryCard } from "./template-library-card";
import { RecentActivityCard } from "./recent-activity-card";
import { DocumentPreviewModal } from "./document-preview-modal";
import { INITIAL_GENERATED_DOCUMENTS, RECENT_ACTIVITIES } from "./mock-data";
import type { IGeneratedDocument, IRecentActivity, TDocumentType } from "./types";

interface IAutomationRootProps {
  workspaceSlug: string;
  projectId: string;
  projectName?: string;
}

export const AutomationRootView: React.FC<IAutomationRootProps> = observer(function AutomationRootView({
  workspaceSlug,
  projectId,
  projectName,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<TDocumentType>("Technical Proposal");
  const [documents, setDocuments] = useState<IGeneratedDocument[]>(INITIAL_GENERATED_DOCUMENTS);
  const [activities, setActivities] = useState<IRecentActivity[]>(RECENT_ACTIVITIES);
  const [previewDoc, setPreviewDoc] = useState<IGeneratedDocument | null>(null);

  const handleSelectTemplate = (tpl: TDocumentType) => {
    setSelectedTemplate(tpl);
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Template Selected",
      message: `Form switched to "${tpl}" template.`,
    });
  };

  const handleDocumentGenerated = (newDoc: IGeneratedDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);

    // Add corresponding activity item
    const newActivity: IRecentActivity = {
      id: `act-${Date.now()}`,
      title: `${newDoc.title} generated`,
      author: `by You • Just now`,
      timestamp: "Just now",
      color: "green",
    };
    setActivities((prev) => [newActivity, ...prev]);

    setToast({
      type: TOAST_TYPE.SUCCESS,
      title: "Document Generated!",
      message: `"${newDoc.title}" has been successfully created.`,
    });
  };

  const handleDeleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleViewAllTemplates = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Template Library",
      message: "Showing all available templates in your workspace.",
    });
  };

  const handleViewAllActivity = () => {
    setToast({
      type: TOAST_TYPE.INFO,
      title: "Activity Log",
      message: "Navigating to project activity log.",
    });
  };

  const pageTitle = projectName ? `${projectName} - AI Document Generator` : "AI Document Generator";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
      <PageHead title={pageTitle} />

      <div className="mx-auto w-full max-w-[1600px] space-y-5 p-5 md:p-6 lg:p-7">
        {/* 1. TOP SECTION: Create New Templates Carousel */}
        <section>
          <TopTemplatesRow
            onSelectTemplate={handleSelectTemplate}
            onViewAllTemplates={handleViewAllTemplates}
          />
        </section>

        {/* 2. MIDDLE SECTION: 2-Column AI Generator + Generated Documents Table */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: AI Document Generator Form */}
          <div className="lg:col-span-4 xl:col-span-4">
            <AIGeneratorForm
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
              onDocumentGenerated={handleDocumentGenerated}
            />
          </div>

          {/* Right Column: Generated Documents Table */}
          <div className="lg:col-span-8 xl:col-span-8">
            <GeneratedDocumentsTable
              documents={documents}
              onPreviewDocument={(doc) => setPreviewDoc(doc)}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        </section>

        {/* 3. BOTTOM SECTION: Template Library + Recent Activity */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Template Library */}
          <div className="lg:col-span-7 xl:col-span-8">
            <TemplateLibraryCard
              onSelectTemplate={handleSelectTemplate}
              onViewAllTemplates={handleViewAllTemplates}
            />
          </div>

          {/* Right Column: Recent Activity */}
          <div className="lg:col-span-5 xl:col-span-4">
            <RecentActivityCard
              activities={activities}
              onViewAllActivity={handleViewAllActivity}
            />
          </div>
        </section>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
});
