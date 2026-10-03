import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { XCircle } from "lucide-react";
import { PlusIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
import { CustomSelect, Input, Spinner } from "@plane/ui";
import { checkEmailValidity } from "@plane/utils";
import { CommonOnboardingHeader } from "@/components/onboarding/steps/common";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
type Fields = FunctionArgs<typeof api.invitations.email.send>["emails"][number];
type Row = Fields & {
  id: string;
  attempt: FunctionReturnType<typeof api.invitations.email.resend> | null;
  error: string;
};
const emptyRow = (): Row => ({ id: crypto.randomUUID(), email: "", role: "member", attempt: null, error: "" });
export function NativeTeamStep({
  workspaceId,
  onComplete,
  onPendingChange,
}: {
  workspaceId: Id<"workspaces">;
  onComplete: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [rows, setRows] = useState(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [pending, setPending] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const policy = useQuery(api.invitations.index.availability);
  const access = useQuery(api.invitations.index.access, { workspaceId, projectId: null });
  const send = useAction(api.invitations.email.send),
    resend = useAction(api.invitations.email.resend);
  const selected = rows.filter((row) => row.email.trim());
  const invalid = selected.length === 0 || selected.some((row) => !checkEmailValidity(row.email));
  const change = (id: string, fields: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...fields } : row)));
  const submit = async () => {
    if (pending || invalid || !policy?.emailDelivery || !access) return;
    setPending(true);
    onPendingChange?.(true);
    try {
      let failed = false;
      for (const row of selected) {
        if (!active.current) return;
        if (row.attempt?.delivery === "sent") continue;
        try {
          // Each delivery has its own canonical receipt; failures never replay successful recipients.
          const attempt = row.attempt
            ? // eslint-disable-next-line no-await-in-loop
              await resend({ invitationId: row.attempt.invitationId, expectedRevision: row.attempt.revision })
            : // eslint-disable-next-line no-await-in-loop
              (await send({ workspaceId, projectId: null, emails: [{ email: row.email, role: row.role }] }))[0];
          if (!active.current) return;
          change(row.id, {
            attempt,
            error:
              attempt.delivery === "sent"
                ? ""
                : "Delivery did not complete. Review this invitation in workspace Members.",
          });
          if (attempt.delivery !== "sent") failed = true;
        } catch (failure) {
          if (!active.current) return;
          failed = true;
          change(row.id, { error: mutationMessage(failure) });
        }
      }
      if (!failed) onComplete();
    } finally {
      if (active.current) setPending(false);
      onPendingChange?.(false);
    }
  };
  return (
    <form
      className="flex flex-col gap-10"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <CommonOnboardingHeader
        title="Invite your teammates"
        description="Work in plane happens best with your team. Invite them now to use Plane to its potential."
      />
      <div className="w-full py-4 text-13">
        <div className="group relative mx-8 grid grid-cols-10 gap-4 py-2">
          <div className="col-span-6 px-1 text-13 font-medium text-secondary">Email</div>
          <div className="col-span-4 px-1 text-13 font-medium text-secondary">Role</div>
        </div>
        <div className="mb-3 space-y-3 sm:space-y-4">
          {rows.map((row, index) => (
            <div key={row.id}>
              <div className="group relative grid grid-cols-10 gap-4">
                <div className="col-span-6">
                  <Input
                    type="email"
                    aria-label={`Email ${index + 1}`}
                    value={row.email}
                    disabled={pending || !!row.attempt}
                    onChange={(event) => change(row.id, { email: event.target.value })}
                    placeholder="charlie.taylor@frstflt.com"
                    className="w-full border-strong text-11 placeholder:text-placeholder sm:text-13"
                    autoComplete="off"
                  />
                </div>
                <div className="col-span-4 mr-8">
                  <CustomSelect
                    value={row.role}
                    label={row.role[0].toUpperCase() + row.role.slice(1)}
                    input
                    className="w-full"
                    placement="bottom-end"
                    disabled={pending || !!row.attempt || !access}
                    onChange={(role: Fields["role"]) => change(row.id, { role })}
                  >
                    {access?.roles.map((role) => (
                      <CustomSelect.Option key={role} value={role}>
                        <span className="text-13 font-medium capitalize">{role}</span>
                      </CustomSelect.Option>
                    ))}
                  </CustomSelect>
                </div>
                {rows.length > 1 && !row.attempt && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove email ${index + 1}`}
                    className="absolute right-0 hidden place-items-center self-center rounded-sm group-hover:grid"
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                  >
                    <XCircle className="h-5 w-5 pl-0.5 text-placeholder" />
                  </button>
                )}
              </div>
              {row.attempt?.delivery === "sent" && <p className="text-11 text-success-primary">Invitation sent</p>}
              {row.error && (
                <p role="alert" className="text-11 text-danger-primary">
                  {row.error}
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          className="mx-8 flex items-center gap-1.5 bg-transparent text-13 font-medium text-accent-primary outline-accent-strong"
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <PlusIcon className="h-4 w-4" strokeWidth={2} />
          Add another
        </button>
      </div>
      {policy && !policy.emailDelivery && (
        <p role="status" className="text-13 text-tertiary">
          Invitation email delivery is not configured. You can invite teammates later.
        </p>
      )}
      <div className="mx-auto flex w-full flex-col items-center justify-center gap-4 px-8 sm:px-2">
        <Button
          variant="primary"
          type="submit"
          size="xl"
          className="w-full"
          disabled={pending || invalid || !policy?.emailDelivery || !access}
        >
          {pending ? <Spinner height="20px" width="20px" /> : "Continue"}
        </Button>
        <Button variant="ghost" size="xl" className="w-full" disabled={pending} onClick={onComplete}>
          I’ll do it later
        </Button>
      </div>
    </form>
  );
}
