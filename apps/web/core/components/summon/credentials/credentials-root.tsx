/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import { observer } from "mobx-react";
import { PageHead } from "@/components/core/page-title";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CredentialsHeader } from "./credentials-header";
import { CredentialsKpiRow } from "./credentials-kpi-row";
import { CredentialsTable } from "./credentials-table";
import { CredentialDetailPanel } from "./credential-detail-panel";
import { AddCredentialModal } from "./add-credential-modal";
import { INITIAL_CREDENTIALS, CREDENTIAL_KPIS } from "./mock-data";
import type { ICredentialItem } from "./types";

interface ISummonCredentialsRootViewProps {
  workspaceSlug: string;
  workspaceName?: string;
}

export const SummonCredentialsRootView: React.FC<ISummonCredentialsRootViewProps> = observer(
  function SummonCredentialsRootView({ workspaceSlug, workspaceName }) {
    const [credentials, setCredentials] = useState<ICredentialItem[]>(INITIAL_CREDENTIALS);
    const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
      INITIAL_CREDENTIALS[0]?.id || ""
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const filteredCredentials = useMemo(() => {
      if (!searchQuery.trim()) return credentials;
      const q = searchQuery.toLowerCase();
      return credentials.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.identifier.toLowerCase().includes(q) ||
          c.project.toLowerCase().includes(q) ||
          c.type.toLowerCase().includes(q)
      );
    }, [credentials, searchQuery]);

    const selectedCredential = useMemo(() => {
      return (
        credentials.find((c) => c.id === selectedCredentialId) ||
        filteredCredentials[0] ||
        null
      );
    }, [credentials, selectedCredentialId, filteredCredentials]);

    const handleAddCredential = (newCred: ICredentialItem) => {
      setCredentials((prev) => [newCred, ...prev]);
      setSelectedCredentialId(newCred.id);
    };

    const handleDeleteCredential = (id: string) => {
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      if (selectedCredentialId === id) {
        const remaining = credentials.filter((c) => c.id !== id);
        setSelectedCredentialId(remaining[0]?.id || "");
      }
    };

    return (
      <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas">
        <PageHead title={workspaceName ? `${workspaceName} - Credential Vault` : "Credential Vault"} />

        <div className="mx-auto w-full max-w-[1600px] space-y-5 p-5 md:p-6 lg:p-7">
          {/* Header */}
          <CredentialsHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onToggleFilter={() => {
              setToast({
                type: TOAST_TYPE.INFO,
                title: "Filters",
                message: "Filter options ready.",
              });
            }}
          />

          {/* 5 KPI Summary Cards */}
          <CredentialsKpiRow kpis={CREDENTIAL_KPIS} />

          {/* 2-Column Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Credentials Table (approx 60% / 7 cols) */}
            <div className="lg:col-span-7">
              <CredentialsTable
                credentials={filteredCredentials}
                selectedCredentialId={selectedCredential?.id || ""}
                onSelectCredential={setSelectedCredentialId}
                onDeleteCredential={handleDeleteCredential}
              />
            </div>

            {/* Right Credential Detail Panel (approx 40% / 5 cols) */}
            <div className="lg:col-span-5">
              <CredentialDetailPanel
                credential={selectedCredential}
                onClose={() => setSelectedCredentialId("")}
                onDelete={handleDeleteCredential}
              />
            </div>
          </div>
        </div>

        {/* Add Modal */}
        <AddCredentialModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAddCredential={handleAddCredential}
        />
      </div>
    );
  }
);
