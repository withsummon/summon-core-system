/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { PageHead } from "@/components/core/page-title";
import { CredentialDrawer } from "@/components/summon/credential-drawer";
import {
  SummonMetric,
  SummonMetricStrip,
  SummonPageHeader,
  summonPageClassName,
  SummonTableShell,
} from "@/components/summon/screen";
import { SummonSearchField } from "@/components/summon/search-field";
import { useMember } from "@/hooks/store/use-member";
import { useUser } from "@/hooks/store/user";
import { ProjectService } from "@/services/project";
import { summonService } from "@/services/summon.service";
import { summarizeCredentials } from "../reference-view-model";
import type { Route } from "./+types/page";
import { CredentialDetailDrawer } from "./credential-detail-drawer";
import { CredentialForm } from "./credential-form";
import { CredentialTable } from "./credential-table";
import { useCredentialForm } from "./use-credential-form";

const projectService = new ProjectService();

export default function SummonCredentialsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data: currentUser } = useUser();
  const { getUserDetails } = useMember();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR(["summon-credentials", workspaceSlug], () =>
    summonService.listCredentials(workspaceSlug)
  );
  const { data: projects = [] } = useSWR(["summon-credential-projects", workspaceSlug], () =>
    projectService.getProjectsLite(workspaceSlug)
  );
  const selected = data?.find((credential) => credential.id === selectedId) ?? data?.[0];
  const { data: accessData, error: accessError } = useSWR(
    selected ? ["summon-credential-detail-access", workspaceSlug, selected.id] : null,
    async () => {
      const [grants, audit] = await Promise.all([
        summonService.listCredentialGrants(workspaceSlug, selected!.id),
        summonService.listCredentialAudit(workspaceSlug, selected!.id),
      ]);
      return { grants, audit };
    },
    { shouldRetryOnError: false }
  );
  const credentialForm = useCredentialForm({
    workspaceSlug,
    selected,
    refresh: () => mutate(),
    onSaved: setSelectedId,
  });

  useEffect(() => setNow(new Date()), []);
  useEffect(() => {
    if (data?.length && !data.some((credential) => credential.id === selectedId)) setSelectedId(data[0].id);
  }, [data, selectedId]);

  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data ?? []).filter((credential) => {
      if (projectFilter !== "all" && credential.project !== projectFilter) return false;
      const projectName = credential.project ? projectNames.get(credential.project) : "";
      return [credential.name, credential.provider, credential.account_identifier, projectName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
  }, [data, projectFilter, projectNames, query]);
  const metrics = useMemo(
    () => summarizeCredentials(data ?? [], currentUser?.id ?? "", now ?? new Date("1970-01-01T00:00:00Z")),
    [currentUser?.id, data, now]
  );
  const openManage = () => setManageOpen(true);

  return (
    <section className={summonPageClassName}>
      <PageHead title="Credential Vault · Summon Core" />
      <SummonPageHeader
        title="Credential Vault"
        description="Accounts, API keys and access credentials for your projects"
        actions={
          <>
            <SummonSearchField
              label="Search credentials"
              placeholder="Search credentials, projects, accounts"
              value={query}
              onValueChange={setQuery}
              className="w-full sm:w-80"
            />
            <Button size="lg" onClick={credentialForm.openCreate}>
              <Plus />
              Add credential
            </Button>
          </>
        }
      />

      <SummonMetricStrip>
        <SummonMetric label="Credentials" value={metrics.total} detail="Accessible to you" />
        <SummonMetric label="Active" value={metrics.active} detail="Not revoked" />
        <SummonMetric label="Shared with me" value={metrics.sharedWithMe} detail="Owned by another member" />
        <SummonMetric label="Expiring soon" value={now ? metrics.expiringSoon : "—"} detail="Within 30 days" />
        <SummonMetric label="High risk" value={metrics.risky} detail="Marked high or critical" />
      </SummonMetricStrip>

      <SummonTableShell>
        <CredentialTable
          data={data}
          error={error}
          isLoading={isLoading}
          onRetry={() => void mutate()}
          filtered={filtered}
          projects={projects}
          projectNames={projectNames}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          selectedId={selected?.id}
          onOpenCredential={(credentialId) => {
            setSelectedId(credentialId);
            setDetailOpen(true);
          }}
        />
      </SummonTableShell>

      <CredentialDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        selected={selected}
        accessData={accessData}
        accessError={accessError}
        projectNames={projectNames}
        getUserDetails={getUserDetails}
        onManage={openManage}
        onEdit={credentialForm.openEdit}
      />

      {credentialForm.formOpen ? (
        <CredentialForm
          credential={credentialForm.editingCredential}
          projects={projects}
          saving={credentialForm.saving}
          error={credentialForm.formError}
          onClose={credentialForm.closeForm}
          onSubmit={credentialForm.saveCredential}
        />
      ) : null}
      <CredentialDrawer
        workspaceSlug={workspaceSlug}
        credential={selected}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onChanged={() => void mutate()}
      />
    </section>
  );
}
