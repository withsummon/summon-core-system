/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Check, X } from "lucide-react";
import { Button } from "@plane/propel/button";
import { DatePicker } from "@plane/propel/date-picker";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { TextArea } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import type { ISummonCredential } from "@plane/types";
import { Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";

export function CredentialForm(props: {
  credential: ISummonCredential | null;
  projects: Array<{ id: string; name: string }>;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const metadata = props.credential?.metadata ?? {};
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Panel width={EDialogWidth.XXL} className="p-5">
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-18 font-semibold text-primary">
            {props.credential ? "Update Credential" : "Add Credential"}
          </Dialog.Title>
          <button type="button" onClick={props.onClose} aria-label="Close">
            <X className="size-4 text-secondary" />
          </button>
        </div>
        <form onSubmit={props.onSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
          <Input name="name" required defaultValue={props.credential?.name} placeholder="Credential name" />
          <Input
            name="account_identifier"
            defaultValue={props.credential?.account_identifier}
            placeholder="Account identifier"
          />
          <SummonField label="Provider">
            <Select
              name="provider"
              defaultValue={props.credential?.provider || "plane_mcp"}
              options={[
                { value: "plane_mcp", label: "Plane MCP PAT" },
                { value: "server", label: "Server" },
                { value: "database", label: "Database" },
                { value: "github", label: "GitHub" },
                { value: "figma", label: "Figma" },
                { value: "tldv", label: "tl;dv API key" },
                { value: "other", label: "Other" },
              ]}
            />
          </SummonField>
          <SummonField label="Project">
            <Select
              name="project"
              defaultValue={props.credential?.project || ""}
              options={[
                { value: "", label: "No project" },
                ...props.projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
            />
          </SummonField>
          {!props.credential ? (
            <Input name="secret" type="password" required autoComplete="new-password" placeholder="Secret or PAT" />
          ) : null}
          <Input
            name="environment"
            defaultValue={typeof metadata.environment === "string" ? metadata.environment : ""}
            placeholder="Environment"
          />
          <Input
            name="host"
            defaultValue={typeof metadata.host === "string" ? metadata.host : ""}
            placeholder="Host / IP"
          />
          <Input name="port" defaultValue={typeof metadata.port === "string" ? metadata.port : ""} placeholder="Port" />
          <Input
            name="protocol"
            defaultValue={typeof metadata.protocol === "string" ? metadata.protocol : ""}
            placeholder="Protocol"
          />
          <DatePicker
            name="expires_at"
            aria-label="Expires on"
            placeholder="Expiry date"
            defaultValue={typeof metadata.expires_at === "string" ? metadata.expires_at.slice(0, 10) : ""}
          />
          <Input
            name="tags"
            defaultValue={Array.isArray(metadata.tags) ? metadata.tags.join(", ") : ""}
            placeholder="Tags, comma separated"
          />
          <SummonField label="Risk">
            <Select
              name="risk"
              defaultValue={typeof metadata.risk === "string" ? metadata.risk : ""}
              options={[
                { value: "", label: "Not assessed" },
                { value: "low", label: "Low" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
            />
          </SummonField>
          <TextArea
            name="description"
            rows={3}
            defaultValue={typeof metadata.description === "string" ? metadata.description : ""}
            placeholder="Description"
            className="sm:col-span-2"
          />
          <p className="text-12 text-tertiary sm:col-span-2">
            Secrets are encrypted server-side and are never returned in list responses.
          </p>
          {props.error ? <p className="text-xs text-danger-primary sm:col-span-2">{props.error}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="xl" type="button" variant="secondary" onClick={props.onClose}>
              Cancel
            </Button>
            <Button size="xl" type="submit" loading={props.saving}>
              <Check className="mr-1.5 size-3.5" />
              Save credential
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
