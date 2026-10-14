/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import {
  ClockCounterClockwiseIcon,
  NoteIcon,
  PaperclipIcon,
  SquaresFourIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Clock3, Copy, Eye, Pencil, Server, ShieldCheck, Trash2, UserRoundPlus } from "lucide-react";
import { Badge } from "@plane/propel/badge";
import type { ISummonCredential, ISummonCredentialAudit, ISummonCredentialGrant, IUserLite } from "@plane/types";
import { capitalizeFirstLetter } from "@plane/utils";
import { SummonDrawer } from "@/components/summon/drawer";
import { SummonRequestState } from "@/components/summon/request-state";
import { SectionTabs } from "@/components/summon/section-tabs";
import type { TSectionTab } from "@/components/summon/section-tabs";
import { formatSummonDate } from "@/components/summon/date";
import { ViewPanel } from "@/components/summon/screen";
import { StatusBadge } from "@/components/summon/status-badge";
import { Action, credentialTags, Detail, MiniDetail, PanelList, textMetadata } from "./credential-shared";

const tabs = ["Overview", "Access", "Activity Log", "Attachments", "Notes"] as const;
type TCredentialTab = (typeof tabs)[number];
const tabItems: TSectionTab<TCredentialTab>[] = [
  { value: "Overview", label: "Overview", icon: SquaresFourIcon },
  { value: "Access", label: "Access", icon: UsersThreeIcon },
  { value: "Activity Log", label: "Activity Log", icon: ClockCounterClockwiseIcon },
  { value: "Attachments", label: "Attachments", icon: PaperclipIcon },
  { value: "Notes", label: "Notes", icon: NoteIcon },
];

type TAccessData = { grants: ISummonCredentialGrant[]; audit: ISummonCredentialAudit[] };
type TGetUserDetails = (userId: string) => IUserLite | undefined;

export function CredentialDetailDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: ISummonCredential | undefined;
  accessData: TAccessData | undefined;
  accessError: unknown;
  projectNames: Map<string, string>;
  getUserDetails: TGetUserDetails;
  onManage: () => void;
  onEdit: () => void;
}) {
  const { selected, accessData, accessError, getUserDetails } = props;
  const [activeTab, setActiveTab] = useState<TCredentialTab>("Overview");
  const lastUsed = accessData?.audit.find((item) => item.action === "use")?.created_at;

  return (
    <SummonDrawer
      open={props.open && Boolean(selected)}
      onOpenChange={props.onOpenChange}
      title="Credential details"
      flush
    >
      {selected ? (
        <>
          <div className="flex items-start gap-4 px-5 py-5">
            <span className="grid size-14 flex-none place-items-center rounded-xl bg-accent-subtle text-accent-primary">
              <Server className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold text-primary" title={selected.name}>
                  {selected.name}
                </h3>
                <StatusBadge status={selected.status} />
              </div>
              <p className="mt-1 text-xs text-secondary capitalize">
                {selected.provider.replaceAll("_", " ")} · {textMetadata(selected, "environment")}
              </p>
              <p className="mt-2 text-12 text-tertiary">
                Last used {formatSummonDate(lastUsed, "Never")} · Created {formatSummonDate(selected.created_at)}
              </p>
            </div>
          </div>
          <SectionTabs
            items={tabItems}
            value={activeTab}
            onValueChange={setActiveTab}
            label="Credential sections"
            className="px-5"
          />
          <div className="p-5">
            <ViewPanel value={activeTab}>
              <CredentialTabContent
                activeTab={activeTab}
                selected={selected}
                accessData={accessData}
                accessError={accessError}
                lastUsed={lastUsed}
                projectNames={props.projectNames}
                getUserDetails={getUserDetails}
                onManage={props.onManage}
                onEdit={props.onEdit}
                onViewAccess={() => setActiveTab("Access")}
              />
            </ViewPanel>
          </div>
          <div className="mx-5 mb-5 flex gap-3 rounded-xl bg-accent-subtle/50 p-4 text-xs text-secondary">
            <ShieldCheck className="size-4 flex-none text-accent-primary" />
            <p>
              This credential is encrypted and stored securely. Secret values are revealed only after password
              confirmation and are audited.
            </p>
          </div>
        </>
      ) : null}
    </SummonDrawer>
  );
}

function CredentialTabContent(props: {
  activeTab: TCredentialTab;
  selected: ISummonCredential;
  accessData: TAccessData | undefined;
  accessError: unknown;
  lastUsed: string | undefined;
  projectNames: Map<string, string>;
  getUserDetails: TGetUserDetails;
  onManage: () => void;
  onEdit: () => void;
  onViewAccess: () => void;
}) {
  const { activeTab, accessData, accessError, getUserDetails } = props;
  if (activeTab === "Overview") return <CredentialOverview {...props} />;
  if (activeTab === "Access")
    return (
      <PanelList
        title="Users with access"
        empty="No active credential grants."
        error={accessError}
        items={
          accessData?.grants.map((grant) => ({
            id: grant.id,
            title: getUserDetails(grant.member)?.display_name || grant.member,
            detail: `${grant.permission} access${grant.expires_at ? ` · expires ${formatSummonDate(grant.expires_at)}` : ""}`,
          })) ?? []
        }
      />
    );
  if (activeTab === "Activity Log")
    return (
      <PanelList
        title="Audit trail"
        empty="No credential activity."
        error={accessError}
        items={
          accessData?.audit.map((audit) => ({
            id: audit.id,
            title: audit.action.replaceAll("_", " "),
            detail: `${formatSummonDate(audit.created_at)}${audit.member ? ` · ${getUserDetails(audit.member)?.display_name || audit.member}` : ""}`,
          })) ?? []
        }
      />
    );
  return (
    <SummonRequestState
      empty
      emptyAsset="credential"
      emptyMessage={`No ${activeTab.toLowerCase()} data source is configured for credentials.`}
    />
  );
}

function CredentialOverview(props: {
  selected: ISummonCredential;
  accessData: TAccessData | undefined;
  lastUsed: string | undefined;
  projectNames: Map<string, string>;
  getUserDetails: TGetUserDetails;
  onManage: () => void;
  onEdit: () => void;
  onViewAccess: () => void;
}) {
  const { selected, onManage } = props;
  const selectedOwner = selected.owner ? props.getUserDetails(selected.owner) : undefined;
  return (
    <div className="grid items-start gap-4">
      <div className="rounded-xl border border-subtle p-4">
        <dl className="grid gap-4 text-xs">
          <Detail label="Username" value={selected.account_identifier || "Not set"} copy />
          <Detail
            label="Password"
            value={selected.secret}
            action={
              <button aria-label="View password" type="button" onClick={onManage} className="text-accent-primary">
                <Eye className="size-4" />
              </button>
            }
          />
          <Detail label="Host / IP" value={textMetadata(selected, "host")} copy />
          <Detail label="Port" value={textMetadata(selected, "port")} />
          <Detail label="Protocol" value={textMetadata(selected, "protocol")} />
          <Detail label="Description" value={textMetadata(selected, "description")} />
          <Detail
            label="Tags"
            value={
              <div className="flex flex-wrap gap-1.5">
                {credentialTags(selected).length
                  ? credentialTags(selected).map((tag) => (
                      <Badge key={tag} variant="brand" size="lg">
                        {capitalizeFirstLetter(tag)}
                      </Badge>
                    ))
                  : "Not set"}
              </div>
            }
          />
          <Detail
            label="Project"
            value={selected.project ? props.projectNames.get(selected.project) || "Linked project" : "Not set"}
          />
          <Detail
            label="Environment"
            value={
              <Badge variant="success" size="lg">
                {capitalizeFirstLetter(textMetadata(selected, "environment"))}
              </Badge>
            }
          />
          <Detail label="Created By" value={selectedOwner?.display_name || "Not available"} />
        </dl>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-subtle p-4">
          <h4 className="text-sm font-semibold text-primary">Quick Actions</h4>
          <div className="mt-3 grid gap-1">
            <Action icon={Eye} label="Reveal Password" onClick={onManage} />
            <Action icon={Pencil} label="Update Credential" onClick={props.onEdit} />
            <Action icon={Clock3} label="Rotate Password" onClick={onManage} />
            <Action icon={UserRoundPlus} label="Share Access" onClick={onManage} />
            <Action icon={Copy} label="Duplicate" disabled />
            <Action icon={Trash2} label="Delete" danger onClick={onManage} />
          </div>
        </div>
        <div className="rounded-xl border border-subtle p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-primary">Access Summary</h4>
            <button type="button" onClick={props.onViewAccess} className="text-12 text-accent-primary">
              View all
            </button>
          </div>
          <dl className="mt-3 grid gap-3">
            <MiniDetail label="Owner" value={selectedOwner?.display_name || "Not available"} />
            <MiniDetail label="Users with access" value={String(props.accessData?.grants.length ?? 0)} />
            <MiniDetail label="Last accessed" value={formatSummonDate(props.lastUsed, "Never")} />
          </dl>
        </div>
      </div>
    </div>
  );
}
