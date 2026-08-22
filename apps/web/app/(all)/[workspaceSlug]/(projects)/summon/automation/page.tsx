/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input, TextArea } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonRecordList, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonAutomationPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [template, setTemplate] = useState("");
  const [project, setProject] = useState("");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, error, isLoading, mutate } = useSWR(["summon-automation", params.workspaceSlug], async () => {
    const [templates, jobs] = await Promise.all([
      summonService.listAutomationTemplates(params.workspaceSlug),
      summonService.listAutomationJobs(params.workspaceSlug),
    ]);
    return { templates, jobs };
  });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.runAutomation(params.workspaceSlug, {
        template,
        project: project || null,
        input: {
          title,
          scope: context,
          client: context,
          decisions: context,
          objective: context,
          key_points: context,
          problem: context,
          success_criteria: context,
        },
      });
      setTitle("");
      setContext("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  const jobs = data?.jobs ?? [];
  return (
    <SummonScreen
      title="Automation"
      description="Deterministic Proposal, Quotation, MoM, Presentation, Cost Projection, and POC outputs saved as Plane Pages."
    >
      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-2">
        <SummonField label="Template">
          <SummonSelect required value={template} onChange={(event) => setTemplate(event.target.value)}>
            <option value="">Select template</option>
            {data?.templates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="Plane Project">
          <SummonSelect value={project} onChange={(event) => setProject(event.target.value)}>
            <option value="">Workspace output</option>
            {joinedProjectIds.map((id) => (
              <option key={id} value={id}>
                {getProjectById(id)?.name ?? id}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="Document title">
          <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
        </SummonField>
        <SummonField label="Context">
          <TextArea
            required
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder="Scope, decisions, objective, or brief"
          />
        </SummonField>
        <Button type="submit" loading={saving}>
          Generate Plane Page
        </Button>
        {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
      </form>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && jobs.length === 0}
        onRetry={() => void mutate()}
      />
      {jobs.length ? (
        <SummonRecordList
          records={jobs.map((item) => ({
            id: item.id,
            title: item.artifacts[0]?.title ?? item.type,
            detail: item.artifacts[0]?.page_detail
              ? `Plane Page: ${item.artifacts[0].page_detail.name}`
              : item.error_summary,
            badge: item.status,
          }))}
        />
      ) : null}
    </SummonScreen>
  );
}
