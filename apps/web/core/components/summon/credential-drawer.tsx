/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button, Input } from "@plane/ui";
import type { ISummonCredential } from "@plane/types";
import { SummonField } from "@/components/summon/forms";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonErrorMessage } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import { Select } from "@plane/propel/select";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";

export function CredentialDrawer(props: {
  workspaceSlug: string;
  credential?: ISummonCredential;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { workspaceSlug, credential, onClose, onChanged } = props;
  const [password, setPassword] = useState("");
  const [revealedSecret, setRevealedSecret] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [member, setMember] = useState("");
  const [permission, setPermission] = useState("view");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    data,
    error: accessError,
    isLoading: accessLoading,
    mutate,
  } = useSWR(
    credential ? ["summon-credential-access", workspaceSlug, credential.id] : null,
    async () => {
      const [grants, audit] = await Promise.all([
        summonService.listCredentialGrants(workspaceSlug, credential!.id),
        summonService.listCredentialAudit(workspaceSlug, credential!.id),
      ]);
      return { grants, audit };
    },
    { shouldRetryOnError: false }
  );

  useEffect(() => {
    setPassword("");
    setRevealedSecret("");
    setNewSecret("");
    setMember("");
    setError("");
  }, [credential?.id]);

  useEffect(() => {
    if (!revealedSecret) return;
    const timer = window.setTimeout(() => setRevealedSecret(""), 30_000);
    const clearWhenHidden = () => {
      if (document.visibilityState === "hidden") setRevealedSecret("");
    };
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, [revealedSecret]);

  if (!credential) return null;

  const reveal = async () => {
    setLoading(true);
    setError("");
    try {
      setRevealedSecret((await summonService.revealCredential(workspaceSlug, credential.id, password)).secret);
    } catch (requestError) {
      setRevealedSecret("");
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  const rotate = async () => {
    setLoading(true);
    setError("");
    try {
      await summonService.rotateCredential(workspaceSlug, credential.id, password, newSecret);
      setNewSecret("");
      setRevealedSecret("");
      onChanged();
      await mutate();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  const grant = async () => {
    setLoading(true);
    setError("");
    try {
      await summonService.grantCredential(workspaceSlug, credential.id, { member, permission });
      setMember("");
      await mutate();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  const revokeGrant = async (grantId: string) => {
    setLoading(true);
    setError("");
    try {
      await summonService.revokeCredentialGrant(workspaceSlug, credential.id, grantId);
      await mutate();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };
  const close = () => {
    setRevealedSecret("");
    setPassword("");
    onClose();
  };
  const revokeCredential = async () => {
    setLoading(true);
    setError("");
    try {
      await summonService.deleteCredential(workspaceSlug, credential.id, password);
      close();
      onChanged();
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <Dialog.Panel
        width={EDialogWidth.LG}
        className="vertical-scrollbar top-0 right-0 left-auto h-dvh max-w-lg translate-x-0 translate-y-0 overflow-y-auto rounded-none border-y-0 border-r-0 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Dialog.Title className="text-18 font-semibold text-primary">{credential.name}</Dialog.Title>
            <p className="text-xs text-secondary">
              {credential.provider} · {credential.account_identifier}
            </p>
          </div>
          <Button variant="neutral-primary" size="sm" onClick={close}>
            Close
          </Button>
        </div>
        {error ? <p className="text-xs mt-4 rounded bg-danger-subtle/20 p-3 text-danger-primary">{error}</p> : null}
        <div className="mt-5 grid gap-3 rounded-lg border border-subtle p-4">
          <h3 className="text-sm font-semibold text-primary">Reveal for 30 seconds</h3>
          <SummonField label="Current password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </SummonField>
          <Button onClick={reveal} loading={loading} disabled={loading || !password}>
            Reveal once
          </Button>
          <output className="font-mono text-sm min-h-10 rounded bg-layer-2 p-3 break-all text-primary">
            {revealedSecret || credential.secret}
          </output>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg border border-subtle p-4">
          <h3 className="text-sm font-semibold text-primary">Rotate secret</h3>
          <SummonField label="New secret">
            <Input
              type="password"
              value={newSecret}
              onChange={(event) => setNewSecret(event.target.value)}
              autoComplete="new-password"
            />
          </SummonField>
          <Button
            variant="neutral-primary"
            onClick={rotate}
            loading={loading}
            disabled={loading || !password || !newSecret}
          >
            Rotate
          </Button>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg border border-subtle p-4">
          <h3 className="text-sm font-semibold text-primary">Grant access</h3>
          <SummonField label="Workspace member ID">
            <Input value={member} onChange={(event) => setMember(event.target.value)} placeholder="User UUID" />
          </SummonField>
          <SummonField label="Permission">
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value)}
              options={[
                { value: "view", label: "View" },
                { value: "use", label: "Use" },
                { value: "manage", label: "Manage" },
              ]}
            />
          </SummonField>
          <Button variant="neutral-primary" onClick={grant} loading={loading} disabled={loading || !member}>
            Grant
          </Button>
          <SummonRequestState loading={accessLoading} error={accessError} onRetry={() => void mutate()} />
          <div className="space-y-2">
            {data?.grants.map((item) => (
              <div key={item.id} className="text-xs flex items-center justify-between gap-2">
                <span className="truncate text-secondary">
                  {item.member} · {item.permission}
                </span>
                <Button variant="link-neutral" size="sm" disabled={loading} onClick={() => void revokeGrant(item.id)}>
                  Revoke
                </Button>
              </div>
            ))}
            {!accessLoading && !data?.grants.length ? <p className="text-xs text-tertiary">No active grants.</p> : null}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-subtle p-4">
          <h3 className="text-sm font-semibold text-primary">Audit</h3>
          <div className="mt-3 space-y-2">
            {data?.audit.map((item) => (
              <div key={item.id} className="text-xs text-secondary">
                <span className="font-medium text-primary">{item.action}</span> ·{" "}
                {new Date(item.created_at).toLocaleString()}
              </div>
            ))}
            {!accessLoading && !data?.audit.length ? <p className="text-xs text-tertiary">No audit events.</p> : null}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-danger-subtle bg-danger-subtle/10 p-4">
          <h3 className="text-sm font-semibold text-danger-primary">Revoke credential</h3>
          <p className="text-xs mt-1 text-secondary">
            Current password confirmation is required and the action is audited.
          </p>
          <Button
            className="mt-3"
            variant="danger"
            onClick={revokeCredential}
            loading={loading}
            disabled={loading || !password}
          >
            Revoke credential
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
