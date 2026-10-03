/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { MeetingDetailWorkspace } from "@/components/summon/meetings/meeting-detail-workspace";
import { TranscriptForm } from "@/components/convex-core/meetings/summary/meeting-summary";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";
import { useAuthenticatedAssetSource } from "@/components/convex-core/assets/image";
import { AssetTransfers } from "@/components/convex-core/documents/asset-transfers";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import type { Route } from "./+types/page";

type Source = Extract<FunctionReturnType<typeof api.meetings.summary.transcripts.get>, { available: true }>;
export default function SummonMeetingDetailPage({ params }: Route.ComponentProps) {
  const session = useOutletContext<WorkspaceSession>();
  const commands = useStickiesCommands();
  const context = useQuery(api.navigation.address.resolveMeetingId, {
    workspaceId: session.workspace._id,
    meetingId: params.meetingId,
  });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={commands.create}
      onOpenStickies={commands.openAll}
      beforeLeave={commands.flushAll}
    >
      {context ? (
        <MeetingWorkspace key={context.meeting._id} context={context} workspaceSlug={session.workspace.slug} />
      ) : (
        <p role="status" className="p-6">
          Opening meeting…
        </p>
      )}
    </PreservedWorkspaceShell>
  );
}
function MeetingWorkspace({
  context,
  workspaceSlug,
}: {
  context: FunctionReturnType<typeof api.navigation.address.resolveMeetingId>;
  workspaceSlug: string;
}) {
  const { meeting } = context;
  const scope = { workspaceId: meeting.workspaceId, meetingId: meeting._id };
  const participants = useQuery(api.meetings.index.participants, scope);
  const source = useQuery(api.meetings.summary.transcripts.get, scope);
  const summary = useQuery(api.meetings.summary.runs.latest, source?.available ? scope : "skip");
  const recording = useQuery(api.assets.meetingRecordings.get, scope);
  const transcription = useQuery(api.meetings.transcription.runs.latest, scope);
  const policy = useQuery(api.assets.meetingRecordings.policy, context.canWrite ? scope : "skip");
  const links = usePaginatedQuery(api.meetings.tasks.list, scope, { initialNumItems: 30 });
  const prepare = useMutation(api.assets.meetingRecordings.prepare);
  const finalize = useAction(api.assets.upload.finalize);
  const discard = useMutation(api.assets.meetingRecordings.discard);
  const start = useMutation(api.meetings.transcription.runs.start);
  const cancel = useMutation(api.meetings.transcription.runs.cancel);
  const [transfers] = useState(() => new AssetTransfers());
  useEffect(() => () => transfers.dispose(), [transfers]);
  const { url: recordingUrl, error: recordingError } = useAuthenticatedAssetSource(recording, "Recording");
  const [uploading, setUploading] = useState(false);
  const [retryingTranscription, setRetryingTranscription] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Source | null>(null);
  const [approved, setApproved] = useState<Extract<Source, { hasTranscript: true }> | null>(null);
  const uploadRecording = async (file: File) => {
    if (!source?.available || !source.canReplaceSource || !policy) return;
    const captured = source;
    setUploading(true);
    setError("");
    let assetId: FunctionReturnType<typeof api.assets.meetingRecordings.prepare>["assetId"] | null = null;
    try {
      await transfers.run(async (signal) => {
        const recordingAssetId = await uploadFileAsset(
          file,
          policy,
          async (metadata) => {
            const ticket = await prepare({ ...scope, ...metadata });
            assetId = ticket.assetId;
            return ticket;
          },
          finalize,
          signal
        );
        await start({
          ...scope,
          recordingAssetId,
          requestId: crypto.randomUUID(),
          expectedMeetingUpdatedAt: captured.meetingUpdatedAt,
          expectedTranscriptRevision: captured.transcriptRevision,
          expectedDocumentRevision: captured.documentRevision,
          expectedDocumentUpdatedAt: captured.documentUpdatedAt,
        });
      });
    } catch (failure) {
      setError(mutationMessage(failure));
      if (assetId) {
        try {
          await discard({ assetId });
        } catch (cleanupError) {
          setError(`${mutationMessage(failure)} ${mutationMessage(cleanupError)}`);
        }
      }
    } finally {
      setUploading(false);
    }
  };
  const transcriptionRunning = transcription?.status === "queued" || transcription?.status === "running";
  return (
    <>
      <MeetingDetailWorkspace
        context={context}
        participants={participants}
        source={source}
        summary={summary}
        links={links.results}
        linksComplete={links.status === "Exhausted"}
        onLoadLinks={links.status === "CanLoadMore" ? () => links.loadMore(30) : undefined}
        recording={recording}
        recordingPolicy={policy}
        recordingUrl={recordingUrl}
        recordingError={error || recordingError}
        workspaceSlug={workspaceSlug}
        summarizing={[uploading, retryingTranscription, transcriptionRunning, summary?.status === "running"].some(
          Boolean
        )}
        uploadingRecording={uploading}
        transcriptionRunning={transcriptionRunning}
        transcription={transcription}
        retryingTranscription={retryingTranscription}
        onUploadRecording={(file) => void uploadRecording(file)}
        onRetryTranscription={
          recording && transcription && (transcription.status === "failed" || transcription.status === "cancelled")
            ? async () => {
                if (!source?.available || !source.canReplaceSource || !recording || retryingTranscription) return;
                const captured = source;
                setRetryingTranscription(true);
                setError("");
                try {
                  await start({
                    ...scope,
                    recordingAssetId: recording.id,
                    requestId: crypto.randomUUID(),
                    expectedMeetingUpdatedAt: captured.meetingUpdatedAt,
                    expectedTranscriptRevision: captured.transcriptRevision,
                    expectedDocumentRevision: captured.documentRevision,
                    expectedDocumentUpdatedAt: captured.documentUpdatedAt,
                  });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setRetryingTranscription(false);
                }
              }
            : undefined
        }
        onDownloadRecording={() => {
          if (!recording || !recordingUrl) return;
          const anchor = document.createElement("a");
          anchor.href = recordingUrl;
          anchor.download = recording.name;
          anchor.click();
        }}
        onCancelTranscription={
          transcriptionRunning
            ? () => {
                void cancel({ runId: transcription._id }).catch((failure) => setError(mutationMessage(failure)));
              }
            : undefined
        }
        onEditTranscript={() => {
          if (source?.available) setEditing(source);
        }}
        onRegenerate={() => {
          if (source?.available && source.hasTranscript && source.canSummarize) setApproved(source);
        }}
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title className="sr-only">Meeting transcript</Dialog.Title>
          {editing && <TranscriptForm {...scope} initial={editing} onClose={() => setEditing(null)} />}
        </Dialog.Panel>
      </Dialog>
      {approved && meeting.projectId && (
        <GenerateMeetingMinutes
          initial={approved}
          workspaceId={meeting.workspaceId}
          meetingId={meeting._id}
          projectId={meeting.projectId}
          onClose={() => setApproved(null)}
        />
      )}
    </>
  );
}
function GenerateMeetingMinutes({
  initial,
  workspaceId,
  meetingId,
  projectId,
  onClose,
}: {
  initial: Extract<Source, { hasTranscript: true }>;
  workspaceId: WorkspaceSession["workspace"]["_id"];
  meetingId: FunctionReturnType<typeof api.meetings.index.get>["_id"];
  projectId: NonNullable<FunctionReturnType<typeof api.meetings.index.get>["projectId"]>;
  onClose: () => void;
}) {
  const summarize = useAction(api.meetings.summary.generate.summarize);
  const [requestId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel className="space-y-4 p-5">
        <Dialog.Title>Generate meeting minutes</Dialog.Title>
        <Dialog.Description>
          Replace the private meeting document content with generated minutes. The source transcript and current sharing
          are preserved.
        </Dialog.Description>
        <div className="flex gap-2">
          <Button
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await summarize({
                  workspaceId,
                  meetingId,
                  requestId,
                  expectedMeetingUpdatedAt: initial.meetingUpdatedAt,
                  expectedTranscriptRevision: initial.transcriptRevision,
                  expectedDocumentRevision: initial.documentRevision,
                  expectedDocumentUpdatedAt: initial.documentUpdatedAt,
                  context: { projectId, clientId: null, documentIds: [], meetingId: null },
                });
                onClose();
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Generate minutes
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </Dialog.Panel>
    </Dialog>
  );
}
