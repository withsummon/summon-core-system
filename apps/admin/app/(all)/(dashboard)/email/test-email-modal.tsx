import { useState } from "react";
import { useAction } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { Dialog } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";

export function SendTestEmailModal({
  isOpen,
  handleClose,
  expectedRevision,
  canEdit,
  onPendingChange,
}: {
  isOpen: boolean;
  handleClose: () => void;
  expectedRevision: number;
  canEdit: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const send = useAction(api.identity.instance.email.test);
  const [intent, setIntent] = useState<FunctionArgs<typeof api.identity.instance.email.test> | null>(null);
  const [recipient, setRecipient] = useState("");
  const [acceptanceId, setAcceptanceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const close = () => {
    if (pending) return;
    setIntent(null);
    setRecipient("");
    setAcceptanceId(null);
    setError(null);
    handleClose();
  };
  const submit = async () => {
    if (!canEdit || pending) return;
    const args = intent ?? { expectedRevision, recipient, requestId: crypto.randomUUID() };
    setIntent(args);
    setPending(true);
    onPendingChange(true);
    setError(null);
    try {
      setAcceptanceId(await send(args));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Resend acceptance could not be confirmed.");
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  };
  return (
    <Dialog
      open={isOpen && canEdit}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Panel className="w-full rounded-lg bg-surface-1 p-5 text-left shadow-raised-200 sm:max-w-xl">
        <Dialog.Title className="text-16 font-medium text-primary">
          {acceptanceId ? "Resend accepted the test email" : "Send test email"}
        </Dialog.Title>
        <div className="space-y-4 pt-6 pb-2">
          {acceptanceId ? (
            <div className="space-y-2 text-13">
              <p>Resend accepted the email to {recipient}. Check the recipient inbox to verify delivery.</p>
              <p className="break-all">Acceptance ID: {acceptanceId}</p>
            </div>
          ) : (
            <>
              <label htmlFor="test-recipient" className="text-13 text-tertiary">
                Recipient email
              </label>
              <Input
                id="test-recipient"
                type="email"
                value={recipient}
                disabled={pending || !canEdit || intent !== null}
                onChange={(event) => {
                  setRecipient(event.target.value);
                  setIntent(null);
                  setError(null);
                }}
                placeholder="Recipient email"
                className="w-full"
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="lg" disabled={pending} onClick={close}>
              {acceptanceId ? "Close" : "Cancel"}
            </Button>
            {!acceptanceId && (
              <Button
                variant="primary"
                size="lg"
                disabled={!recipient || !canEdit || pending}
                loading={pending}
                onClick={() => {
                  void submit();
                }}
              >
                {error ? "Retry same test" : "Send email"}
              </Button>
            )}
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
