/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { ISummonCredential } from "@plane/types";
import { summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";

/** Create/update dialog state for the credential vault. */
export function useCredentialForm(props: {
  workspaceSlug: string;
  selected: ISummonCredential | undefined;
  refresh: () => Promise<unknown>;
  onSaved: (credentialId: string) => void;
}) {
  const { workspaceSlug, selected, refresh, onSaved } = props;
  const [formOpen, setFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<ISummonCredential | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openCreate = () => {
    setEditingCredential(null);
    setFormError("");
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selected) return;
    setEditingCredential(selected);
    setFormError("");
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);
  const saveCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const metadata = {
      environment: form.get("environment") || "",
      description: form.get("description") || "",
      host: form.get("host") || "",
      port: form.get("port") || "",
      protocol: form.get("protocol") || "",
      expires_at: form.get("expires_at") || "",
      tags: String(form.get("tags") || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      risk: form.get("risk") || "",
    };
    const payload = {
      name: form.get("name"),
      provider: form.get("provider"),
      account_identifier: form.get("account_identifier"),
      project: form.get("project") || null,
      metadata,
    };
    setSaving(true);
    setFormError("");
    try {
      const saved = editingCredential
        ? await summonService.updateCredential(workspaceSlug, editingCredential.id, payload)
        : await summonService.createCredential(workspaceSlug, { ...payload, secret: form.get("secret") });
      await refresh();
      onSaved(saved.id);
      setFormOpen(false);
    } catch (requestError) {
      setFormError(summonErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return { formOpen, editingCredential, saving, formError, openCreate, openEdit, closeForm, saveCredential };
}
