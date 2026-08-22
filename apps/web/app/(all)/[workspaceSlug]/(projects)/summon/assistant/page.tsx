/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Button, Input } from "@plane/ui";
import type { ISummonAssistantResponse } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonCard, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

const intents = [
  "portfolio_status",
  "overdue_work_items",
  "client_opportunity_pipeline",
  "project_summary",
  "knowledge_page_lookup",
  "automation_history",
];

export default function SummonAssistantPage({ params }: Route.ComponentProps) {
  const { joinedProjectIds, getProjectById } = useProject();
  const [intent, setIntent] = useState(intents[0]);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [answer, setAnswer] = useState<ISummonAssistantResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setAnswer(
        await summonService.queryAssistant(params.workspaceSlug, { intent, query, project_id: projectId || null })
      );
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  return (
    <SummonScreen
      title="Assistant"
      description="Deterministic answers over records you can access. Unsupported prompts never invent data."
    >
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-3 md:items-end"
      >
        <SummonField label="Intent">
          <SummonSelect value={intent} onChange={(event) => setIntent(event.target.value)}>
            {intents.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="Search">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Optional page name" />
        </SummonField>
        <SummonField label="Project">
          <SummonSelect value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">All accessible projects</option>
            {joinedProjectIds.map((id) => (
              <option key={id} value={id}>
                {getProjectById(id)?.name ?? id}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <Button type="submit" loading={loading}>
          Query authorized data
        </Button>
      </form>
      {error ? <p className="text-xs text-danger-primary">{error}</p> : null}
      {answer ? (
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">{answer.answer}</h2>
          <pre className="text-xs mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap text-secondary">
            {JSON.stringify(answer.data, null, 2)}
          </pre>
        </SummonCard>
      ) : null}
    </SummonScreen>
  );
}
