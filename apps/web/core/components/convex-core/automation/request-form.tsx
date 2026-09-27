import { useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ContextFields } from "../assistant/conversation-form";
import { mutationMessage, selectClass } from "../commercial/forms";
type Context = FunctionArgs<typeof api.automation.generate.preview>["context"];
export function RequestForm({
  workspaceId,
  template,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  template: Doc<"automationTemplates">;
  onDone: (id: Id<"automationJobs">) => void;
  onCancel: () => void;
}) {
  const projects = useQuery(api.projects.index.list, { workspaceId });
  const preview = useAction(api.automation.generate.preview);
  const [title, setTitle] = useState("");
  const [input, setInput] = useState<Record<string, string>>({});
  const [context, setContext] = useState<Context>({
    projectId: null,
    clientId: null,
    meetingId: null,
    documentIds: [],
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<{ signature: string; requestId: string } | null>(null);
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!context.projectId) return;
        const args = {
          templateId: template._id,
          expectedTemplateRevision: template.revision,
          projectId: context.projectId,
          title,
          input,
          context,
        };
        const signature = JSON.stringify(args);
        if (request.current?.signature !== signature) request.current = { signature, requestId: crypto.randomUUID() };
        setPending(true);
        setError("");
        try {
          onDone(await preview({ ...args, requestId: request.current.requestId }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <header>
        <p className="text-12 text-secondary">New preview</p>
        <h2 className="text-24 font-semibold">{template.name}</h2>
        <p className="mt-2 text-14 text-secondary">{template.description}</p>
      </header>
      <fieldset disabled={pending} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SummonField label="Document title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} />
          </SummonField>
          <SummonField label="Destination project">
            <select
              className={selectClass}
              value={context.projectId ?? ""}
              required
              onChange={(e) => {
                const project = projects?.find((p) => p._id === e.target.value);
                setContext({ ...context, projectId: project?._id ?? null });
              }}
            >
              <option value="">Choose project</option>
              {projects
                ?.filter((p) => p.membershipRole !== "guest" && p.workspaceRole !== "guest")
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </SummonField>
        </div>
        {template.variables.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {template.variables.map((variable) => (
              <SummonField key={variable} label={variable}>
                <textarea
                  className={`${selectClass} w-full`}
                  rows={3}
                  value={input[variable] ?? ""}
                  onChange={(e) => setInput({ ...input, [variable]: e.target.value })}
                />
              </SummonField>
            ))}
          </div>
        )}
        <details className="rounded-lg border border-subtle-1 p-4">
          <summary className="cursor-pointer text-14 font-medium">Context sources</summary>
          <div className="mt-4">
            <ContextFields workspaceId={workspaceId} value={context} onChange={setContext} showProject={false} />
          </div>
        </details>
        <p className="text-14 text-secondary">
          Generation creates a private preview. Publishing it to the selected project is a separate step.
        </p>
        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={!template.isActive}>
            Generate preview
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {pending && (
        <p role="status" className="text-14 text-secondary">
          Generating your preview…
        </p>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
