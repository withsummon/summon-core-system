/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
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
      title="Summon Assistant"
      description="Deterministic answers over records you can access. Unsupported prompts never invent data."
    >
      <SummonCard className="bg-gradient-to-br from-accent-subtle to-surface-1">
        <div className="flex items-start gap-3">
          <span className="bg-accent-strong grid size-10 flex-shrink-0 place-items-center rounded-xl text-on-color">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-primary">How can I help you today?</h2>
            <p className="text-sm mt-1 text-secondary">
              Ask for portfolio status, overdue tasks, project summaries, knowledge, or automation history.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intents.slice(0, 6).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setIntent(item)}
              className="text-sm flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-1 px-3 py-3 text-left font-medium text-primary hover:border-accent-strong"
            >
              {item.replaceAll("_", " ")}
              <ArrowRight className="size-4 flex-shrink-0 text-accent-primary" />
            </button>
          ))}
        </div>
      </SummonCard>
      <SummonCard>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3 md:items-end">
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
      </SummonCard>
      {error ? <p className="text-xs text-danger-primary">{error}</p> : null}
      {answer ? (
        <SummonCard>
          <div className="text-sm flex items-center gap-2 font-semibold text-primary">
            <Sparkles className="size-4 text-accent-primary" />
            {answer.answer}
          </div>
          <pre className="text-xs mt-4 max-h-[28rem] overflow-auto rounded-lg bg-layer-1 p-4 whitespace-pre-wrap text-secondary">
            {JSON.stringify(answer.data, null, 2)}
          </pre>
        </SummonCard>
      ) : null}
    </SummonScreen>
  );
}
