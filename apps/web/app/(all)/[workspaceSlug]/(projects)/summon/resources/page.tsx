/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonMetric, SummonScreen, summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonResourcesPage({ params }: Route.ComponentProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("repository");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    data = [],
    error,
    isLoading,
    mutate,
  } = useSWR(["summon-resources", params.workspaceSlug], () => summonService.listResources(params.workspaceSlug));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await summonService.createResource(params.workspaceSlug, { title, url, category });
      setTitle("");
      setUrl("");
      await mutate();
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SummonScreen
      title="Resources"
      description="External URLs live here once. Uploaded documents stay in Plane FileAsset and Pages."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummonMetric label="All resources" value={data.length} detail="External references" />
        <SummonMetric
          label="Categories"
          value={new Set(data.map((item) => item.category)).size}
          detail="Resource types"
        />
        <SummonMetric
          label="Linked projects"
          value={new Set(data.map(({ project }) => project).filter(Boolean)).size}
          detail="Plane relationships"
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <SummonRequestState
            loading={isLoading}
            error={error}
            empty={!isLoading && data.length === 0}
            onRetry={() => void mutate()}
          />
          {data.length ? (
            <div className="shadow-sm divide-y divide-subtle overflow-hidden rounded-xl border border-subtle bg-surface-1">
              {data.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-layer-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium text-primary">{item.title}</p>
                    <p className="text-xs mt-1 truncate text-secondary">{item.url}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-layer-2 px-2 py-1 text-[11px] text-secondary">
                    {item.category}
                  </span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <SummonCard>
          <h2 className="text-sm font-semibold text-primary">Add resource</h2>
          <p className="text-xs mt-1 text-secondary">Keep one canonical external link.</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <SummonField label="Title">
              <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
            </SummonField>
            <SummonField label="External URL">
              <Input
                required
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
              />
            </SummonField>
            <SummonField label="Type">
              <SummonSelect value={category} onChange={(event) => setCategory(event.target.value)}>
                {["repository", "figma", "deployment", "drive", "recording", "account"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </SummonSelect>
            </SummonField>
            <Button type="submit" loading={saving}>
              Add resource
            </Button>
            {formError ? <p className="text-xs text-danger-primary">{formError}</p> : null}
          </form>
        </SummonCard>
      </div>
    </SummonScreen>
  );
}
