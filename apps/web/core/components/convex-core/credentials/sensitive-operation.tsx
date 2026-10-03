import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type Operation = FunctionArgs<typeof api.mcp.stepUp.verify>["operation"];
const labels: Record<Operation, string> = {
  reveal: "Reveal secret",
  rotate: "Rotate secret",
  revoke: "Revoke credential",
  delete: "Delete credential",
};
export function SensitiveOperation({
  credentialId,
  operation,
  onClose,
  onDeleted,
}: {
  credentialId: Id<"mcpCredentials">;
  operation: Operation;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const verify = useMutation(api.mcp.stepUp.verify);
  const reveal = useAction(api.mcp.sensitive.reveal);
  const rotate = useAction(api.mcp.sensitive.rotate);
  const revoke = useMutation(api.mcp.sensitive.revoke);
  const remove = useMutation(api.mcp.sensitive.remove);
  const [password, setPassword] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (revealed === null) return;
    const timer = setTimeout(onClose, 30_000);
    const hide = () => {
      if (document.visibilityState === "hidden") onClose();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [revealed, onClose]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.LG} className="p-5">
        <Dialog.Title className="text-20 font-semibold">{labels[operation]}</Dialog.Title>
        {revealed !== null ? (
          <div className="mt-4 space-y-4">
            <p className="text-14 text-secondary">Hidden after 30 seconds or when you leave this tab.</p>
            <pre className="rounded-lg bg-layer-1 p-3 break-all whitespace-pre-wrap" aria-label="Revealed secret">
              {revealed}
            </pre>
            <Button onClick={onClose}>Hide secret</Button>
          </div>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              try {
                const proofId = await verify({ credentialId, operation, password });
                setPassword("");
                if (proofId === null) {
                  setError("Password verification failed. Check your current password and try again.");
                  return;
                }
                if (operation === "reveal") {
                  const value = await reveal({ proofId });
                  if (mounted.current && document.visibilityState === "visible") setRevealed(value);
                  else onClose();
                } else if (operation === "rotate") {
                  await rotate({ proofId, secret: newSecret });
                  setNewSecret("");
                  onClose();
                } else if (operation === "revoke") {
                  await revoke({ proofId });
                  onClose();
                } else {
                  await remove({ proofId });
                  onDeleted();
                }
              } catch (failure) {
                setError(mutationMessage(failure));
                setPassword("");
              } finally {
                setPending(false);
              }
            }}
          >
            <p className="text-14 text-secondary">
              {operation === "delete"
                ? "Delete this credential and its stored secret. This cannot be undone."
                : operation === "revoke"
                  ? "Stop this credential from authorizing new MCP requests."
                  : "Confirm your sign-in password to continue."}
            </p>
            <SummonField label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </SummonField>
            {operation === "rotate" && (
              <SummonField label="New secret">
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                />
              </SummonField>
            )}
            {error && (
              <p role="alert" className="text-14 text-danger-primary">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pending}>
                Verify and {labels[operation].toLowerCase()}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog.Panel>
    </Dialog>
  );
}
