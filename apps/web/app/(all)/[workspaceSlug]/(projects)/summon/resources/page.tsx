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
import { SummonScreen, summonErrorMessage } from "@/components/summon/screen";
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
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-subtle bg-surface-1 p-4 md:grid-cols-4 md:items-end"
      >
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
        {formError ? <p className="text-xs text-danger-primary md:col-span-4">{formError}</p> : null}
      </form>
      <SummonRequestState
        loading={isLoading}
        error={error}
        empty={!isLoading && data.length === 0}
        onRetry={() => void mutate()}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-subtle bg-surface-1 p-4 hover:bg-layer-1"
          >
            <p className="text-sm font-medium text-primary">{item.title}</p>
            <p className="text-xs mt-1 truncate text-secondary">{item.url}</p>
            <span className="mt-3 inline-block rounded-full bg-layer-2 px-2 py-1 text-[11px] text-secondary">
              {item.category}
            </span>
          </a>
        ))}
      </div>
    </SummonScreen>
  );
}
