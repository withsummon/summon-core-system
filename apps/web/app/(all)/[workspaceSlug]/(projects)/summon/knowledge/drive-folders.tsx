/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowUpRight, FileText, Folder, FolderSync, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
import { Banner } from "@plane/propel/banner";
import { Button, getButtonStyling } from "@plane/propel/button";
import { Select } from "@plane/propel/select";
import type { SummonClient } from "@plane/summon-contract";
import { Input } from "@plane/ui";
import { calculateTimeAgo } from "@plane/utils";
import { SummonDrawer } from "@/components/summon/drawer";
import { SummonField } from "@/components/summon/forms";
import { summonErrorMessage } from "@/components/summon/screen";
import { useProject } from "@/hooks/store/use-project";
import { summonService } from "@/services/summon.service";

const GOOGLE_DRIVE_PROVIDER = "google_drive";

const DRIVE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not set up on this instance. Ask an admin to add a Google OAuth client.",
  drive_access_not_granted: "Google access was not granted.",
  drive_scope_missing: "Google did not grant Drive access. Connect again and leave the Google Drive box ticked.",
  drive_auth_revoked: "Google access was revoked. Reconnect the account to resume syncing.",
  drive_credential_required: "Select a Google account you can use.",
  project_required: "Select a project you can edit.",
  drive_link_invalid: "Paste a link to a Google Drive folder, Doc, Sheet or Slides.",
  drive_file_unsupported: "Only Google Docs, Sheets and Slides sync as pages. PDFs and uploaded files stay in Drive.",
  drive_not_found: "This Google account cannot open that link. Check it, or ask its owner to share it.",
  drive_access_denied:
    "Google refused access to Drive. Ask an admin to enable the Google Drive API for the OAuth client.",
  drive_unavailable: "Google Drive could not be reached. Try again shortly.",
  drive_page_failed: "A Drive file could not be turned into a page. Sync again shortly.",
  already_exists: "This link is already synced.",
};

const driveError = (error: unknown) => {
  const code = error && typeof error === "object" && "error_code" in error ? String(error.error_code) : "";
  return DRIVE_ERRORS[code] ?? summonErrorMessage(error);
};

const syncedCount = (count: number) => `${count} synced Drive ${count === 1 ? "item" : "items"}`;

function useDriveFolders(workspaceSlug: string) {
  return useSWR(["summon-drive-folders", workspaceSlug], () => summonService.listDriveFolders(workspaceSlug));
}

/** Above Knowledge when a synced Drive item has stopped following Drive, since its pages quietly go stale. */
export function DriveSyncWarning({ workspaceSlug, onReview }: { workspaceSlug: string; onReview: () => void }) {
  const { data: folders = [] } = useDriveFolders(workspaceSlug);
  const broken = folders.filter((folder) => folder.health !== "ok");
  if (!broken.length) return null;
  const revoked = broken.filter((folder) => folder.health === "revoked");
  const accounts = [...new Set(revoked.map((folder) => folder.account))];
  const others = broken.length - revoked.length;
  return (
    <Banner
      variant="warning"
      role="alert"
      icon={<TriangleAlert className="size-4" aria-hidden />}
      title={[
        revoked.length
          ? `Google access for ${accounts.join(", ")} was revoked, so ${syncedCount(revoked.length)} stopped syncing.`
          : "",
        others
          ? `${revoked.length ? `${others} more` : syncedCount(others)} ${others === 1 ? "is" : "are"} not syncing.`
          : "",
        "Their pages may be out of date.",
      ]
        .filter(Boolean)
        .join(" ")}
      action={
        <>
          {revoked.length ? (
            <a
              href={summonService.googleDriveConnectUrl(workspaceSlug)}
              className={getButtonStyling("primary", "base")}
            >
              Reconnect Google
            </a>
          ) : null}
          <Button variant="secondary" size="base" onClick={onReview}>
            Review
          </Button>
        </>
      }
    />
  );
}

/** Knowledge's Google Drive action: the synced folders and files, and a form to add one. Synced files land as locked pages. */
export function DriveFolders(props: {
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where Google's consent round trip ended: "connected", or an error code. */
  returnedWith: string;
}) {
  const { workspaceSlug } = props;
  const { mutate: revalidate } = useSWRConfig();
  const { joinedProjectIds, getProjectById } = useProject();
  const [chosenAccount, setChosenAccount] = useState("");
  const [project, setProject] = useState("");
  const [folder, setFolder] = useState("");
  const [formError, setFormError] = useState(() =>
    props.returnedWith && props.returnedWith !== "connected" ? driveError({ error_code: props.returnedWith }) : ""
  );
  const [busy, setBusy] = useState("");

  const { data: folders, mutate } = useDriveFolders(workspaceSlug);
  const { data: credentials } = useSWR(props.open ? ["summon-credentials", workspaceSlug] : null, () =>
    summonService.listCredentials(workspaceSlug)
  );
  const accounts = (credentials ?? []).filter(
    (item) => item.provider === GOOGLE_DRIVE_PROVIDER && item.status === "active"
  );
  const credential = chosenAccount || accounts[0]?.id || "";
  const connectUrl = summonService.googleDriveConnectUrl(workspaceSlug);

  // Each change adds or rewrites pages, so the Knowledge library reloads with the folder list.
  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setFormError("");
    try {
      await action();
      await Promise.all([mutate(), revalidate(["summon-plane-pages", workspaceSlug])]);
      return true;
    } catch (requestError) {
      setFormError(driveError(requestError));
      return false;
    } finally {
      setBusy("");
    }
  };

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    const connected = await run("connect", () =>
      summonService.connectDriveFolder(workspaceSlug, { credential, project, folder })
    );
    if (connected) setFolder("");
  };

  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => props.onOpenChange(true)}>
        <FolderSync aria-hidden />
        Google Drive
      </Button>
      <SummonDrawer
        open={props.open}
        onOpenChange={props.onOpenChange}
        title="Google Drive"
        description="A synced Doc, Sheet or Slides file, or every one in a synced folder, becomes a read-only page here that follows each edit in Drive."
      >
        <div className="grid grid-cols-1 gap-6">
          {folders?.length ? (
            <ul className="divide-y divide-subtle rounded-md border border-subtle">
              {folders.map((item) => (
                <DriveFolderRow
                  key={item.id}
                  folder={item}
                  projectName={getProjectById(item.project)?.name ?? "Project"}
                  connectUrl={connectUrl}
                  busy={busy}
                  onSync={() =>
                    void run(`sync:${item.id}`, () => summonService.syncDriveFolder(workspaceSlug, item.id))
                  }
                  onDisconnect={() =>
                    void run(`disconnect:${item.id}`, () => summonService.disconnectDriveFolder(workspaceSlug, item.id))
                  }
                />
              ))}
            </ul>
          ) : null}
          {credentials && !accounts.length ? (
            <div className="grid grid-cols-1 gap-3">
              <h3 className="text-13 font-medium text-primary">Connect Google Drive</h3>
              <p className="text-13 text-secondary">
                Sign in with the Google account that can open the folders and files you want here. Summon only reads
                Drive, and you can revoke its access from your Google account at any time.
              </p>
              {formError ? (
                <p className="text-12 text-danger-primary" role="alert">
                  {formError}
                </p>
              ) : null}
              <a href={connectUrl} className={getButtonStyling("primary", "lg")}>
                Connect Google account
              </a>
            </div>
          ) : (
            <form onSubmit={connect} className="grid grid-cols-1 gap-3">
              <h3 className="text-13 font-medium text-primary">Sync from Drive</h3>
              {props.returnedWith === "connected" ? (
                <p className="text-12 text-success-primary" role="status">
                  Google account connected.
                </p>
              ) : null}
              <SummonField label="Google account">
                <Select
                  required
                  value={credential}
                  onValueChange={(value) => setChosenAccount(value)}
                  options={[
                    { value: "", label: credentials ? "Select an account" : "Loading accounts…" },
                    ...accounts.map((item) => ({ value: item.id, label: item.account_identifier || item.name })),
                  ]}
                />
              </SummonField>
              <a href={connectUrl} className="-mt-1 justify-self-start text-12 text-accent-primary hover:underline">
                Connect another Google account
              </a>
              <SummonField label="Project">
                <Select
                  required
                  value={project}
                  onValueChange={(value) => setProject(value)}
                  options={[
                    { value: "", label: "Select project" },
                    ...joinedProjectIds.map((id) => ({ value: id, label: getProjectById(id)?.name ?? id })),
                  ]}
                />
              </SummonField>
              <SummonField label="Folder or file link">
                <Input
                  required
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="Paste a Drive folder, Doc, Sheet or Slides link"
                />
              </SummonField>
              <p className="text-12 text-tertiary">
                A folder brings its subfolders and every file added later. PDFs and other files stay in Drive.
              </p>
              {formError ? (
                <p className="text-12 text-danger-primary" role="alert">
                  {formError}
                </p>
              ) : null}
              <Button
                size="lg"
                type="submit"
                loading={busy === "connect"}
                disabled={!credential || !project || !folder.trim()}
              >
                Sync
              </Button>
            </form>
          )}
        </div>
      </SummonDrawer>
    </>
  );
}

function DriveFolderRow(props: {
  folder: SummonClient.DriveFolder;
  projectName: string;
  connectUrl: string;
  busy: string;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const { folder } = props;
  const synced = folder.last_synced_at ? `synced ${calculateTimeAgo(folder.last_synced_at)}` : "not synced yet";
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <a
          href={folder.folder_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-13 font-medium text-primary hover:underline"
        >
          {folder.kind === "folder" ? (
            <Folder className="size-3.5 flex-none text-tertiary" aria-label="Folder" />
          ) : (
            <FileText className="size-3.5 flex-none text-tertiary" aria-label="File" />
          )}
          <span className="truncate">{folder.name}</span>
          <ArrowUpRight className="size-3.5 flex-none text-tertiary" aria-hidden />
        </a>
        <p className="text-12 text-tertiary">
          {props.projectName} ·{" "}
          {folder.kind === "folder" ? `${folder.file_count} ${folder.file_count === 1 ? "file" : "files"} · ` : ""}
          {folder.live ? `Live, ${synced}` : `Checked every 15 minutes, ${synced}`}
        </p>
        {folder.health === "revoked" ? (
          <p className="text-12 text-danger-primary">
            Google access for <span className="break-all">{folder.account}</span> was revoked.{" "}
            <a href={props.connectUrl} className="font-medium underline">
              Reconnect
            </a>
          </p>
        ) : null}
        {folder.health === "error" ? (
          <p className="text-12 text-danger-primary">
            {DRIVE_ERRORS[folder.sync_error] ?? DRIVE_ERRORS.drive_unavailable}
          </p>
        ) : null}
        {folder.health === "stalled" ? (
          <p className="text-12 text-warning-primary">Not synced for over an hour. Sync now to retry.</p>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="base"
        aria-label={`Sync ${folder.name} now`}
        loading={props.busy === `sync:${folder.id}`}
        disabled={Boolean(props.busy)}
        onClick={props.onSync}
      >
        <RefreshCw aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="base"
        aria-label={`Stop syncing ${folder.name}`}
        loading={props.busy === `disconnect:${folder.id}`}
        disabled={Boolean(props.busy)}
        onClick={props.onDisconnect}
      >
        <Unlink aria-hidden />
      </Button>
    </li>
  );
}
