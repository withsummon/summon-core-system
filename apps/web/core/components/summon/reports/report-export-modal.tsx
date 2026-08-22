/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { X, Download, FileText, CheckCircle2, Sparkles, Sliders } from "lucide-react";
import { DOCUMENT_TEMPLATES } from "./mock-data";
import type { TDocumentTemplateType } from "./types";

interface IReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug?: string;
}

export function ReportExportModal({ isOpen, onClose }: IReportExportModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<TDocumentTemplateType>("mom_iglo");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<string>("DOCX");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuccess, setGeneratedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentTemplate = DOCUMENT_TEMPLATES.find((t) => t.id === selectedTemplateId) || DOCUMENT_TEMPLATES[0];

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setGeneratedSuccess(false);

    setTimeout(() => {
      // Create comprehensive downloadable file based on selected template
      let docBody = `# ${currentTemplate.sampleTitle}\n`;
      docBody += `Template: ${currentTemplate.name}\n`;
      docBody += `Generated on: ${new Date().toISOString()}\n\n`;

      docBody += `## Document Metadata & Parameters\n`;
      currentTemplate.fields.forEach((field) => {
        const val = formData[field.key] || field.placeholder || "Default Sample Value";
        docBody += `- **${field.label}**: ${val}\n`;
      });

      docBody += `\n## Structured Content & Sections\n`;
      currentTemplate.sections.forEach((sec, idx) => {
        docBody += `### ${idx + 1}. ${sec}\n`;
        docBody += `Content generated according to ${currentTemplate.name} guidelines and enterprise governance.\n\n`;
      });

      const blob = new Blob([docBody], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentTemplate.id}_export_${Date.now()}.${format.toLowerCase() === "xlsx" ? "csv" : format.toLowerCase() === "docx" ? "docx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsGenerating(false);
      setGeneratedSuccess(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="shadow-2xl flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-1">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-subtle px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary">Generate Executive & Technical Documents</h2>
              <p className="text-xs text-secondary">
                Select from 10 enterprise document standards: MoMs, Proposals, Quotations, Timeline, BAST, UAT, and
                Defects.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-layer-1 hover:text-primary"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[280px_1fr]">
          {/* Left Column: Template Selector */}
          <div className="overflow-y-auto border-r border-subtle bg-layer-1 p-3">
            <div className="tracking-wider mb-2 px-2 text-[11px] font-semibold text-tertiary uppercase">
              Document Templates ({DOCUMENT_TEMPLATES.length})
            </div>
            <div className="space-y-1">
              {DOCUMENT_TEMPLATES.map((tmpl) => {
                const isSelected = tmpl.id === currentTemplate.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      setFormat(tmpl.format);
                      setGeneratedSuccess(false);
                    }}
                    className={`text-xs flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? "shadow-sm bg-accent-primary font-semibold text-white"
                        : "font-medium text-secondary hover:bg-layer-2 hover:text-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{tmpl.name}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-layer-2 text-tertiary"
                        }`}
                      >
                        {tmpl.format}
                      </span>
                    </div>
                    <span className={`mt-0.5 text-[10px] ${isSelected ? "text-white/80" : "text-tertiary"}`}>
                      {tmpl.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Template Customization & Generator Form */}
          <div className="flex flex-col overflow-y-auto p-6">
            <div className="rounded-xl border border-subtle bg-layer-1 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded bg-accent-primary/10 px-2 py-0.5 text-[10px] font-semibold text-accent-primary">
                    {currentTemplate.category}
                  </span>
                  <h3 className="text-base mt-1 font-bold text-primary">{currentTemplate.name}</h3>
                  <p className="text-xs mt-1 text-secondary">{currentTemplate.description}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-subtle bg-surface-1 p-1">
                  {(["DOCX", "PDF", "XLSX", "PPTX"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`rounded px-2 py-1 text-[11px] font-bold transition-all ${
                        format === fmt ? "bg-accent-primary text-white" : "text-secondary hover:text-primary"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sections Breakdown */}
              <div className="mt-3.5 border-t border-subtle pt-3">
                <span className="text-[11px] font-semibold text-secondary">Document Sections Included:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {currentTemplate.sections.map((sec) => (
                    <span
                      key={sec}
                      className="rounded-md border border-subtle bg-surface-1 px-2 py-0.5 text-[11px] font-medium text-secondary"
                    >
                      ✓ {sec}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="mt-5 space-y-4">
              <div className="text-xs flex items-center gap-1.5 font-semibold text-primary">
                <Sliders className="size-3.5 text-accent-primary" />
                Customize Document Variables
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentTemplate.fields.map((field) => (
                  <div key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="text-xs block font-medium text-secondary">{field.label}</label>
                    {field.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={formData[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-xs placeholder-tertiary focus:border-accent-primary focus:ring-accent-primary mt-1 w-full rounded-lg border border-subtle bg-surface-1 p-2.5 text-primary focus:ring-1 focus:outline-none"
                      />
                    ) : field.type === "select" ? (
                      <select
                        value={formData[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="text-xs focus:border-accent-primary focus:ring-accent-primary mt-1 w-full rounded-lg border border-subtle bg-surface-1 p-2.5 text-primary focus:ring-1 focus:outline-none"
                      >
                        <option value="">Select option...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={formData[field.key] || ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="text-xs placeholder-tertiary focus:border-accent-primary focus:ring-accent-primary mt-1 w-full rounded-lg border border-subtle bg-surface-1 p-2.5 text-primary focus:ring-1 focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Success Banner */}
            {generatedSuccess && (
              <div className="bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 mt-4 flex items-center gap-2 rounded-xl p-3 font-semibold">
                <CheckCircle2 className="size-4 shrink-0" />
                Document generated and downloaded successfully as {format}!
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-subtle bg-layer-1 px-6 py-3.5">
          <span className="text-xs text-secondary">
            Format selected: <strong className="text-primary">{format}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs rounded-lg border border-subtle bg-surface-1 px-4 py-2 font-semibold text-secondary hover:bg-layer-2 hover:text-primary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="text-xs shadow-md flex items-center gap-2 rounded-lg bg-accent-primary px-5 py-2 font-bold text-white transition-all hover:bg-accent-primary/90 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="size-4 animate-spin" />
                  Generating Document...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Generate & Download {currentTemplate.name}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
