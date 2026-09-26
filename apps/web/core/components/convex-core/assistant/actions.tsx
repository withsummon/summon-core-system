import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
import { statusOptions } from "../tasks/options";
export function ConversationActions({ conversation }: { conversation: Doc<"assistantConversations"> }) {
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
        {results.map((action) => (
          <ActionCard key={action._id} action={action} />
        ))}
        {status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => loadMore(25)}>
            Load more actions
          </Button>
        )}
      </div>
    </details>
  );
}
function ActionProposal({
  conversationId,
  projectId,
}: {
  conversationId: Id<"assistantConversations">;
  projectId: Id<"projects">;
}) {
  const { results, status, loadMore } = usePaginatedQuery(api.tasks.index.list, { projectId }, { initialNumItems: 50 });
  const propose = useMutation(api.assistant.actions.propose);
  const [taskId, setTaskId] = useState<Id<"tasks"> | null>(null);
  const [nextStatus, setNextStatus] = useState<Doc<"tasks">["status"]>("todo");
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
function ActionCard({ action }: { action: Doc<"assistantActions"> }) {
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
        {statusOptions.find((option) => option.value === action.previousStatus)?.label} →{" "}
        {statusOptions.find((option) => option.value === action.nextStatus)?.label}
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
