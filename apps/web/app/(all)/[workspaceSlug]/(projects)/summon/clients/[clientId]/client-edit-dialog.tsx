/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@plane/propel/button";
import { DatePicker } from "@plane/propel/date-picker";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Select } from "@plane/propel/select";
import type { ISummonClientDetail } from "@plane/types";
import { Input } from "@plane/ui";
import { summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";

export function ClientEditDialog(props: {
  workspaceSlug: string;
  clientId: string;
  data: ISummonClientDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<unknown>;
}) {
  const { workspaceSlug, clientId, data, open, onOpenChange, onSaved } = props;
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const updateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setFormError("");
    try {
      await summonService.updateClient(workspaceSlug, clientId, {
        name: form.get("name"),
        company_name: form.get("company_name"),
        industry: form.get("industry"),
        website: form.get("website"),
        head_office: form.get("head_office"),
        relationship_started_at: form.get("relationship_started_at") || null,
        notes: form.get("notes"),
        status: form.get("status"),
      });
      await onSaved();
      onOpenChange(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Panel width={EDialogWidth.XL} className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Dialog.Title className="text-18 font-semibold text-primary">Edit Client</Dialog.Title>
            <p className="mt-1 text-xs text-secondary">Changes are saved to the Summon client record.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center rounded-lg border border-subtle text-secondary"
            aria-label="Close edit client"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={updateClient} className="mt-5 grid gap-3 sm:grid-cols-2">
          <EditField label="Client name">
            <Input name="name" required defaultValue={data.name} />
          </EditField>
          <EditField label="Legal name">
            <Input name="company_name" defaultValue={data.company_name} />
          </EditField>
          <EditField label="Industry">
            <Input name="industry" defaultValue={data.industry} />
          </EditField>
          <EditField label="Website">
            <Input name="website" type="url" defaultValue={data.website} />
          </EditField>
          <EditField label="Head office">
            <Input name="head_office" defaultValue={data.head_office} />
          </EditField>
          <EditField label="Relationship started">
            <DatePicker name="relationship_started_at" defaultValue={data.relationship_started_at || ""} />
          </EditField>
          <EditField label="Status">
            <Select
              name="status"
              defaultValue={data.status}
              options={[
                { value: "lead", label: "Lead" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </EditField>
          <label className="text-12 text-secondary sm:col-span-2">
            Notes
            <textarea
              name="notes"
              rows={4}
              defaultValue={data.notes}
              className="mt-1 w-full rounded-md border border-subtle bg-surface-1 p-3 text-xs text-primary"
            />
          </label>
          {formError ? <p className="text-xs text-danger-primary sm:col-span-2">{formError}</p> : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button size="xl" type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="xl" type="submit" loading={saving}>
              Save changes
            </Button>
          </div>
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}

function EditField(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-12 text-secondary">
      {props.label}
      <span className="mt-1 block">{props.children}</span>
    </label>
  );
}
