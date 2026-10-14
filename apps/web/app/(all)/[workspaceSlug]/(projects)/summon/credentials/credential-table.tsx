/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Server } from "lucide-react";
import { Badge } from "@plane/propel/badge";
import { Select } from "@plane/propel/select";
import type { ISummonCredential } from "@plane/types";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { SummonRequestState } from "@/components/summon/request-state";
import { formatSummonDate } from "@/components/summon/date";
import { StatusBadge } from "@/components/summon/status-badge";
import { textMetadata } from "./credential-shared";

/** Column labels: the desktop header and the phone row label read from the same entry. */
const CREDENTIAL_COLUMNS = {
  name: "Credential Name",
  type: "Type",
  project: "Project",
  environment: "Environment",
  lastUsed: "Last Used",
  status: "Status",
} as const;

export function CredentialTable(props: {
  data: ISummonCredential[] | undefined;
  error: unknown;
  isLoading: boolean;
  onRetry: () => void;
  filtered: ISummonCredential[];
  projects: Array<{ id: string; name: string }>;
  projectNames: Map<string, string>;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  selectedId: string | undefined;
  onOpenCredential: (credentialId: string) => void;
}) {
  const { data, filtered, projectNames, selectedId, onOpenCredential } = props;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Select
          value={props.projectFilter}
          onValueChange={(value) => props.onProjectFilterChange(value)}
          className="w-40"
          options={[
            { value: "all", label: "All Projects" },
            ...props.projects.map((project) => ({ value: project.id, label: project.name })),
          ]}
        />
        <span className="text-12 text-secondary tabular-nums">
          {filtered.length} {filtered.length === 1 ? "credential" : "credentials"}
        </span>
      </div>
      {!data ? (
        <div className="p-4">
          <SummonRequestState loading={props.isLoading} error={props.error} onRetry={props.onRetry} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4">
          <SummonRequestState
            empty
            emptyAsset="search"
            emptyTitle="No matching credentials"
            emptyMessage="Try another search or filter."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-stack w-full text-left text-xs md:min-w-[680px]">
            <thead className="border-y border-subtle bg-layer-1/60 text-12 text-tertiary">
              <tr>
                <th className="px-4 py-3">{CREDENTIAL_COLUMNS.name}</th>
                <th className="px-3 py-3">{CREDENTIAL_COLUMNS.type}</th>
                <th className="px-3 py-3">{CREDENTIAL_COLUMNS.project}</th>
                <th className="px-3 py-3">{CREDENTIAL_COLUMNS.environment}</th>
                <th className="px-3 py-3">{CREDENTIAL_COLUMNS.lastUsed}</th>
                <th className="px-3 py-3">{CREDENTIAL_COLUMNS.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {filtered.map((credential) => (
                <tr
                  key={credential.id}
                  className={selectedId === credential.id ? "bg-accent-subtle/50" : "hover:bg-layer-1"}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenCredential(credential.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent-subtle text-accent-primary">
                        <Server className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-primary" title={credential.name}>
                          {credential.name}
                        </span>
                        <span className="mt-0.5 block truncate text-12 text-secondary">
                          {credential.account_identifier || "No account identifier"}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td data-label={CREDENTIAL_COLUMNS.type} className="px-3 py-3">
                    <Badge size="lg">{capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(credential.provider))}</Badge>
                  </td>
                  <td data-label={CREDENTIAL_COLUMNS.project} className="px-3 py-3 text-secondary">
                    {credential.project ? projectNames.get(credential.project) || "Linked project" : "—"}
                  </td>
                  <td data-label={CREDENTIAL_COLUMNS.environment} className="px-3 py-3">
                    <Badge variant="success" size="lg">
                      {capitalizeFirstLetter(textMetadata(credential, "environment"))}
                    </Badge>
                  </td>
                  <td data-label={CREDENTIAL_COLUMNS.lastUsed} className="px-3 py-3 text-secondary">{formatSummonDate(credential.updated_at, "Never")}</td>
                  <td data-label={CREDENTIAL_COLUMNS.status} className="px-3 py-3">
                    <StatusBadge status={credential.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
