import { useEffect, useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { EmptyState } from "@/components/common/empty-state";
import emptyInvitation from "@/app/assets/empty-state/invitation.svg?url";
import { Checkbox, Spinner } from "@plane/ui";
import { CommonOnboardingHeader } from "@/components/onboarding/steps/common";
import { mutationMessage } from "@/components/convex-core/commercial/forms";

type Invitation = FunctionReturnType<typeof api.invitations.index.incoming>["page"][number];
export function NativeWorkspaceInvitations({
  onComplete,
  onCreate,
  presentation = "onboarding",
  onPendingChange,
}: {
  onComplete: (invitation: FunctionReturnType<typeof api.invitations.index.acceptIncoming>[number]) => void;
  onCreate: () => void;
  presentation?: "onboarding" | "standalone";
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const { results, status, loadMore } = usePaginatedQuery(api.invitations.index.incoming, {}, { initialNumItems: 20 });
  const accept = useMutation(api.invitations.index.acceptIncoming);
  const policy = useQuery(api.invitations.index.availability);
  const [selected, setSelected] = useState<Invitation[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const onboarding = presentation === "onboarding";
  const buttonSize = onboarding ? "xl" : "lg";
  const acceptLabel = onboarding ? "Continue" : t("accept_and_join");
  const hasNoInvitations = status === "Exhausted" && results.length === 0;
  if (!onboarding && hasNoInvitations && selected.length === 0)
    return (
      <div className="fixed top-0 left-0 grid size-full place-items-center">
        <EmptyState
          title={t("no_pending_invites")}
          description={t("you_can_see_here_if_someone_invites_you_to_a_workspace")}
          image={emptyInvitation}
          primaryButton={{ text: t("back_to_home"), onClick: onCreate }}
        />
      </div>
    );
  return (
    <div className="flex flex-col gap-10">
      {onboarding ? (
        <CommonOnboardingHeader title="Join invites or create a workspace" description="All your work — unified." />
      ) : (
        <>
          <h5 className="text-16">{t("we_see_that_someone_has_invited_you_to_join_a_workspace")}</h5>
          <h4 className="text-20 font-semibold">{t("join_a_workspace")}</h4>
        </>
      )}
      <div className={onboarding ? "flex flex-col gap-3" : "max-h-[37vh] space-y-4 overflow-y-auto md:w-3/5"}>
        {status === "LoadingFirstPage" && <p role="status">Loading invitations…</p>}
        {results.map((invitation) => (
          <InvitationChoice
            key={invitation._id}
            invitation={invitation}
            standalone={!onboarding}
            selected={selected.some((row) => row._id === invitation._id)}
            disabled={
              pending ||
              !policy ||
              (selected.length >= policy.maxAcceptInvitations && !selected.some((row) => row._id === invitation._id))
            }
            onToggle={() =>
              setSelected((current) =>
                current.some((row) => row._id === invitation._id)
                  ? current.filter((row) => row._id !== invitation._id)
                  : [...current, invitation]
              )
            }
          />
        ))}
        {selected
          .filter((row) => !results.some((current) => current._id === row._id))
          .map((row) => (
            <Button
              key={row._id}
              variant="ghost"
              disabled={pending}
              onClick={() => setSelected((current) => current.filter((item) => item._id !== row._id))}
            >
              Remove unavailable invitation selection
            </Button>
          ))}
        {hasNoInvitations && <p>No Invitations found</p>}
        {status === "CanLoadMore" && (
          <Button variant="ghost" onClick={() => loadMore(20)}>
            Load more invitations
          </Button>
        )}
        {status === "LoadingMore" && <p role="status">Loading more invitations…</p>}
      </div>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
      <div className={onboarding ? "flex flex-col gap-4" : "flex items-center gap-3"}>
        <Button
          variant="primary"
          size={buttonSize}
          loading={pending}
          disabled={selected.length === 0}
          aria-label={acceptLabel}
          onClick={async () => {
            setPending(true);
            onPendingChange?.(true);
            setError("");
            try {
              const accepted = await accept({
                invitations: selected.map((row) => ({ invitationId: row._id, expectedRevision: row.revision })),
              });
              onComplete(accepted[0]);
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
              onPendingChange?.(false);
            }
          }}
        >
          {pending ? <Spinner height="20px" width="20px" /> : acceptLabel}
        </Button>
        <Button variant={onboarding ? "ghost" : "secondary"} size={buttonSize} loading={pending} onClick={onCreate}>
          {onboarding ? "Create new workspace" : t("go_home")}
        </Button>
      </div>
    </div>
  );
}
function InvitationChoice({
  invitation,
  standalone,
  selected,
  disabled,
  onToggle,
}: {
  invitation: Invitation;
  standalone: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const preview = useAction(api.invitations.email.incomingPreview);
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setLogo(null);
    setError("");
    const load = async () => {
      try {
        const result = await preview({ invitationId: invitation._id });
        if (!active || !result.logo) return;
        url = URL.createObjectURL(new Blob([result.logo.bytes], { type: result.logo.contentType }));
        setLogo(url);
      } catch (failure) {
        if (active) setError(mutationMessage(failure));
      }
    };
    void load();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invitation._id, invitation.revision, preview]);
  return (
    <div>
      <label
        className={
          standalone
            ? `flex cursor-pointer items-center gap-2 rounded-sm border px-3.5 py-5 has-focus-visible:outline-2 has-focus-visible:outline-accent-strong ${selected ? "border-accent-strong" : "border-subtle hover:bg-layer-1"}`
            : "flex cursor-pointer items-center gap-2 rounded-lg border border-subtle px-3 py-2 hover:bg-surface-2"
        }
      >
        <div
          className={`relative grid ${standalone ? "size-9" : "size-8"} flex-shrink-0 place-items-center rounded-lg bg-accent-primary text-on-color uppercase`}
        >
          {logo ? (
            <img
              src={logo}
              className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
              alt="Workspace logo"
            />
          ) : (
            invitation.workspaceName?.[0]
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-13 font-medium">{invitation.workspaceName}</div>
          <p className="text-11 text-secondary capitalize">
            {invitation.role}
            {invitation.projectName ? ` · ${invitation.projectName}` : ""}
          </p>
        </div>
        {standalone ? (
          <>
            <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} className="sr-only" />
            <CheckCircle2 className={`size-5 flex-shrink-0 ${selected ? "text-accent-primary" : "text-secondary"}`} />
          </>
        ) : (
          <Checkbox checked={selected} disabled={disabled} onCheckedChange={onToggle} />
        )}
      </label>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
