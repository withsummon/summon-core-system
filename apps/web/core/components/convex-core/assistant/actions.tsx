import { useState } from "react";
import { useNavigate } from "react-router";
import { CredentialInvocations } from "../credentials/invocations";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { usePaginatedQuery as useTaskPages } from "convex-helpers/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
import { statusOptions, taskStatusOptions } from "../tasks/options";
export function ConversationActions({
  conversation,
  workspaceSlug,
}: {
  conversation: Doc<"assistantConversations">;
  workspaceSlug: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.assistant.actions.list,
    { conversationId: conversation._id },
    { initialNumItems: 25 }
  );
  const projects = useQuery(api.projects.index.list, { workspaceId: conversation.workspaceId });
  const [selectedProjectId, setProjectId] = useState<Id<"projects"> | null>(null);
  const projectId = conversation.context.projectId ?? selectedProjectId;
  const targetProject = projects?.find((project) => project._id === projectId);
  const canPropose =
    targetProject && targetProject.membershipRole !== "guest" && targetProject.workspaceRole !== "guest";
  return (
    <div className="space-y-3">
      {results.map((action) =>
        action.operation === "generate_document" ? (
          <DocumentAction key={action._id} action={action} conversation={conversation} workspaceSlug={workspaceSlug} />
        ) : (
          <ActionCard key={action._id} action={action} />
        )
      )}
      <McpRequests conversation={conversation} />
      <details className="rounded-xl border border-subtle-1 p-4">
        <summary className="text-sm cursor-pointer font-medium">
          Task actions{results.some((action) => action.status === "pending") ? " · Approval required" : ""}
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs text-secondary">Preview a status group change, then confirm it explicitly.</p>
          {!conversation.context.projectId && (
            <SummonField label="Action project" htmlFor="action-project">
              <select
                id="action-project"
                className={selectClass}
                value={projectId ?? ""}
                onChange={(event) => {
                  const project = projects?.find((item) => item._id === event.target.value);
                  setProjectId(project?._id ?? null);
                }}
              >
                <option value="">Select project</option>
                {projects
                  ?.filter((project) => project.membershipRole !== "guest" && project.workspaceRole !== "guest")
                  .map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </SummonField>
          )}
          {projectId && canPropose && (
            <ActionProposal key={projectId} conversationId={conversation._id} projectId={projectId} />
          )}

          {status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => loadMore(25)}>
              Load more actions
            </Button>
          )}
        </div>
      </details>
    </div>
  );
}
function ActionProposal({
  conversationId,
  projectId,
}: {
  conversationId: Id<"assistantConversations">;
  projectId: Id<"projects">;
}) {
  const { results, status, loadMore } = useTaskPages(api.tasks.index.list, { projectId }, { initialNumItems: 50 });
  const propose = useMutation(api.assistant.actions.propose);
  const [taskId, setTaskId] = useState<Id<"tasks"> | null>(null);
  const [nextStatus, setNextStatus] =
    useState<FunctionArgs<typeof api.assistant.actions.propose>["nextStatus"]>("todo");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!taskId) return;
        setPending(true);
        setError("");
        try {
          await propose({ conversationId, taskId, nextStatus });
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
        <SummonField label="Task" htmlFor="action-task">
          <select
            id="action-task"
            className={`${selectClass} max-w-72`}
            required
            value={taskId ?? ""}
            onChange={(event) => {
              const task = results.find((item) => item._id === event.target.value);
              setTaskId(task?._id ?? null);
            }}
          >
            <option value="">Select task</option>
            {results.map((task) => (
              <option key={task._id} value={task._id}>
                {task.title}
              </option>
            ))}
          </select>
        </SummonField>
        <SummonField label="New status group" htmlFor="action-status">
          <select
            id="action-status"
            className={selectClass}
            value={nextStatus}
            onChange={(event) => {
              const option = statusOptions.find((item) => item.value === event.target.value);
              if (option) setNextStatus(option.value);
            }}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SummonField>
        <Button type="submit" loading={pending} disabled={!taskId}>
          Preview change
        </Button>
      </fieldset>
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more tasks
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function ActionCard({ action }: { action: Extract<Doc<"assistantActions">, { operation: "set_task_status" }> }) {
  const confirm = useMutation(api.assistant.actions.confirm);
  const cancel = useMutation(api.assistant.actions.cancel);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function act(operation: "confirm" | "cancel") {
    setPending(true);
    setError("");
    try {
      await (operation === "confirm" ? confirm : cancel)({ actionId: action._id });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="space-y-3 rounded-lg border border-subtle-1 bg-layer-1 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="text-sm font-medium break-words">{action.taskTitle}</h3>
        <span className="text-xs text-secondary capitalize">{action.status}</span>
      </div>
      <p className="text-sm">
        {taskStatusOptions[action.previousStatus].label} → {taskStatusOptions[action.nextStatus].label}
      </p>
      {action.status === "pending" && (
        <>
          <p className="text-xs text-secondary">Changing the status group clears the task’s custom state.</p>
          <div className="flex gap-2">
            <Button loading={pending} onClick={() => void act("confirm")}>
              Confirm change
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => void act("cancel")}>
              Cancel action
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </article>
  );
}

function DocumentAction({
  action,
  conversation,
  workspaceSlug,
}: {
  action: Extract<Doc<"assistantActions">, { operation: "generate_document" }>;
  conversation: Doc<"assistantConversations">;
  workspaceSlug: string;
}) {
  const navigate = useNavigate();
  const templates = usePaginatedQuery(
    api.automation.templates.list,
    { workspaceId: conversation.workspaceId },
    { initialNumItems: 100 }
  );
  const projects = useQuery(api.projects.index.list, { workspaceId: conversation.workspaceId });
  const select = useMutation(api.assistant.actions.selectDocument);
  const execute = useAction(api.assistant.actions.executeDocument);
  const cancel = useMutation(api.assistant.actions.cancel);
  const job = useQuery(api.automation.jobs.get, action.jobId ? { jobId: action.jobId } : "skip");
  const [chosenTemplateId, setTemplateId] = useState<string | null>(null);
  const templateId = chosenTemplateId ?? action.templateId ?? "";
  const [chosenProjectId, setProjectId] = useState<string | null>(null);
  const projectId = chosenProjectId ?? action.projectId ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    const template = templates.results.find((item) => item._id === templateId);
    const project = projects?.find((item) => item._id === projectId);
    if (!template || !project) return;
    setPending(true);
    setError("");
    try {
      if (!action.confirmedAt) await select({ actionId: action._id, templateId: template._id, projectId: project._id });
      await execute({ actionId: action._id, expectedAttempt: action.generationAttempt });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="space-y-3 rounded-xl border border-subtle-1 p-4">
      <h3 className="text-sm font-medium">Generate document · {action.status}</h3>
      <p className="text-sm break-words">{action.request}</p>
      {["pending", "failed"].includes(action.status) && (
        <>
          <fieldset disabled={pending || Boolean(action.confirmedAt)} className="grid gap-3 sm:grid-cols-2">
            <SummonField label="Document template" htmlFor={`template-${action._id}`}>
              <select
                id={`template-${action._id}`}
                className={selectClass}
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">Choose template</option>
                {templates.results
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </SummonField>
            <SummonField label="Destination project" htmlFor={`project-${action._id}`}>
              <select
                id={`project-${action._id}`}
                className={selectClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">Choose project</option>
                {projects
                  ?.filter((item) => item.membershipRole !== "guest" && item.workspaceRole !== "guest")
                  .map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </SummonField>
          </fieldset>
          {templates.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => templates.loadMore(100)}>
              Load more templates
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              loading={pending}
              disabled={!templateId || !projectId || job?.status === "running"}
              onClick={() => void confirm()}
            >
              {action.status === "failed" ? "Retry generation" : "Confirm generation"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || job?.status === "running"}
              onClick={() => {
                void cancel({ actionId: action._id }).catch((failure) => setError(mutationMessage(failure)));
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
      {job && (
        <Button variant="secondary" onClick={() => navigate(`/${workspaceSlug}/summon/automation/${job._id}/`)}>
          Open generated document · {job.status}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-primary">
          {error}
        </p>
      )}
    </article>
  );
}
function McpRequests({ conversation }: { conversation: Doc<"assistantConversations"> }) {
  const list = usePaginatedQuery(
    api.mcp.credentials.list,
    { workspaceId: conversation.workspaceId },
    { initialNumItems: 30 }
  );
  const [selected, setSelected] = useState<Id<"mcpCredentials"> | null>(null);
  const credential = useQuery(api.mcp.credentials.get, selected ? { credentialId: selected } : "skip");
  return (
    <details className="rounded-xl border border-subtle-1 p-4">
      <summary className="text-sm cursor-pointer font-medium">Plane MCP commands</summary>
      <div className="mt-4 space-y-3">
        <SummonField label="Plane MCP credential" htmlFor="assistant-mcp-credential">
          <select
            id="assistant-mcp-credential"
            className={selectClass}
            value={selected ?? ""}
            onChange={(event) => setSelected(list.results.find((row) => row._id === event.target.value)?._id ?? null)}
          >
            <option value="">Choose credential</option>
            {list.results
              .filter((row) => row.canInvokeMcp)
              .map((row) => (
                <option key={row._id} value={row._id}>
                  {row.name}
                </option>
              ))}
          </select>
        </SummonField>
        {list.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => list.loadMore(30)}>
            Load more credentials
          </Button>
        )}
        {credential && credential.workspaceId === conversation.workspaceId && credential.canUse && (
          <CredentialInvocations credential={credential} conversationId={conversation._id} />
        )}
      </div>
    </details>
  );
}
