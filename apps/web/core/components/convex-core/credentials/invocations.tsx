import { useState } from "react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
export function CredentialInvocations({
  credential,
  conversationId,
}: {
  credential: FunctionReturnType<typeof api.mcp.credentials.get>;
  conversationId?: Id<"assistantConversations">;
}) {
  const capabilities = useQuery(api.mcp.invocations.capabilities, { credentialId: credential._id });
  const requests = usePaginatedQuery(
    api.mcp.invocations.list,
    { credentialId: credential._id },
    { initialNumItems: 20 }
  );
  const propose = useMutation(api.mcp.invocations.propose);
  const [tool, setTool] = useState("");
  const [argumentsJson, setArgumentsJson] = useState('{\n  "action": "list"\n}');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          try {
            await propose({
              conversationId,
              credentialId: credential._id,
              requestId: crypto.randomUUID(),
              tool,
              argumentsJson,
            });
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <h3 className="text-16 font-medium">New MCP request</h3>
        <SummonField label="Tool" htmlFor="mcp-tool">
          <select
            id="mcp-tool"
            required
            className="rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            value={tool}
            onChange={(e) => {
              setTool(e.target.value);
              const first = capabilities?.tools.find((t) => t.tool === e.target.value)?.actions[0];
              if (first)
                setArgumentsJson(
                  JSON.stringify(
                    {
                      action: first.action,
                      ...(credential.remoteProjectId ? { project_id: credential.remoteProjectId } : {}),
                    },
                    null,
                    2
                  )
                );
            }}
          >
            <option value="">Choose tool</option>
            {capabilities?.tools.map((t) => (
              <option key={t.tool} value={t.tool}>
                {t.tool}
              </option>
            ))}
          </select>
        </SummonField>
        {tool && (
          <p className="text-12 text-secondary">
            Actions:{" "}
            {capabilities?.tools
              .find((t) => t.tool === tool)
              ?.actions.map((a) => `${a.action}${a.write ? " (write)" : ""}`)
              .join(", ")}
          </p>
        )}
        <SummonField label="Arguments (JSON)" htmlFor="mcp-arguments">
          <textarea
            id="mcp-arguments"
            required
            maxLength={32000}
            rows={7}
            spellCheck={false}
            value={argumentsJson}
            onChange={(e) => setArgumentsJson(e.target.value)}
            className="font-mono w-full rounded-md border border-subtle-1 bg-layer-2 p-3 text-12"
          />
        </SummonField>
        <Button type="submit" loading={pending} disabled={!tool || credential.status !== "active"}>
          Review request
        </Button>
        {capabilities && !capabilities.configured && (
          <p className="text-14 text-secondary">MCP execution is not configured. You can review and cancel requests.</p>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </form>
      <section className="space-y-3">
        <h3 className="text-16 font-medium">Your requests</h3>
        {requests.results.map((request) => (
          <Invocation key={request._id} request={request} configured={capabilities?.configured ?? false} />
        ))}
        {requests.status === "LoadingFirstPage" && <p role="status">Loading requests…</p>}
        {requests.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => requests.loadMore(20)}>
            Load more requests
          </Button>
        )}
      </section>
    </div>
  );
}
function Invocation({
  request,
  configured,
}: {
  request: FunctionReturnType<typeof api.mcp.invocations.list>["page"][number];
  configured: boolean;
}) {
  const invocationId = request._id;
  const confirm = useAction(api.mcp.client.confirm);
  const cancel = useMutation(api.mcp.invocations.cancel);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="space-y-3 rounded-xl border border-subtle-1 p-4">
      <header className="flex flex-wrap justify-between gap-2 text-14">
        <strong>
          {request.tool} · {request.write ? "External write" : "External read"}
        </strong>
        <span>{request.status}</span>
      </header>
      <pre className="overflow-x-auto rounded-md bg-layer-1 p-3 text-12">{request.argumentsJson}</pre>
      {request.status === "pending" && (
        <div className="space-y-2">
          <p className="text-14 text-secondary">
            {request.write
              ? "Approval sends this change to the remote workspace."
              : "Approval sends this request to the remote workspace."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              disabled={!configured}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await confirm({ invocationId });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Approve and execute
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await cancel({ invocationId });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Cancel request
            </Button>
          </div>
        </div>
      )}
      {request.resultJson && (
        <details>
          <summary className="cursor-pointer text-14">Result</summary>
          <pre className="mt-2 max-h-72 overflow-auto text-12 break-all whitespace-pre-wrap">{request.resultJson}</pre>
        </details>
      )}
      {(request.error || error) && (
        <p role="alert" className="text-14 text-danger-primary">
          {request.error ?? error}
        </p>
      )}
    </article>
  );
}
