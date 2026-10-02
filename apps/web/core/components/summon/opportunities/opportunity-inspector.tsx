import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { Controller, useForm } from "react-hook-form";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import { generateWorkItemLink } from "@plane/utils";
import { OpportunityForm } from "@/components/convex-core/commercial/opportunity-form";
import { Delivery } from "@/components/convex-core/commercial/delivery";
import { memberLabel } from "@summon/convex/member-label";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  FileText,
  Mail,
  MessageSquare,
  Presentation,
  ReceiptText,
  Sparkles,
  Video,
  NotebookPen,
} from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, OPPORTUNITY_STAGE_TONE } from "./opportunity-pipeline";
import { Select } from "@plane/propel/select";

const formatDate = (value?: string | number | null) =>
  value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not set";

export const initials = (value: string) =>
  value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function opportunityMoney(
  currency: string,
  value: FunctionReturnType<typeof api.commercial.opportunities.get>["input"]["value"]
) {
  if (value === null) return "Not set";
  const [integer, fraction] = value.split(".");
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(BigInt(integer))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
  return integer === "-0" ? `-${formatted}` : formatted;
}
export function StageChip({ stage }: { stage: Doc<"opportunities">["stage"] }) {
  const tone = OPPORTUNITY_STAGE_TONE[stage];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-11 font-medium whitespace-nowrap ${tone.chip}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${tone.dot}`} />
      {OPPORTUNITY_STAGE_LABEL[stage]}
    </span>
  );
}

export function OpportunityInspector(props: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  context: FunctionReturnType<typeof api.commercial.opportunities.get>;
  backHref?: string;
  backClassName?: string;
}) {
  const { workspace, context } = props;
  const workspaceSlug = workspace.slug;
  const detail = context.record;
  const [editing, setEditing] = useState(false);
  if (!detail) throw new Error("Opportunity inspector requires an existing opportunity.");
  const owner = context.owner ? memberLabel(context.owner) : undefined;
  const automationQuery = new URLSearchParams({
    opportunity: detail._id,
    client: detail.clientId ?? "",
    context: detail.title,
  }).toString();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {props.backHref ? (
        <Link
          href={props.backHref}
          className={`inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-2 text-12 font-medium text-secondary hover:bg-layer-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong ${props.backClassName ?? ""}`}
        >
          <ArrowLeft className="size-4" /> Back to results
        </Link>
      ) : null}
      <article className="@container flex min-w-0 flex-col gap-4" aria-labelledby={`opportunity-${detail._id}`}>
        <header className="flex flex-wrap items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 flex-none place-items-center rounded-xl bg-accent-subtle text-13 font-semibold text-accent-primary"
          >
            {initials(detail.title)}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={`opportunity-${detail._id}`}
              className="text-18 leading-snug font-semibold text-balance text-primary"
            >
              {detail.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-secondary">
              {context.client && !context.client.deleted ? (
                <Link
                  href={`/${workspaceSlug}/summon/clients/${context.client._id}/`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:text-accent-primary hover:underline"
                >
                  <Building2 className="size-3.5" />
                  {context.client.companyName || context.client.name}
                </Link>
              ) : (
                <span>{context.client ? context.client.companyName || context.client.name : "No client"}</span>
              )}
              <span aria-hidden>·</span>
              <span>Updated {formatDate(detail.updatedAt)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StageChip stage={detail.stage} />
            {context.canWrite && (
              <Button size="lg" variant="secondary" onClick={() => setEditing(true)}>
                Edit opportunity
              </Button>
            )}
          </div>
        </header>

        <StageTrack stage={detail.stage} />

        <dl className="grid grid-cols-2 overflow-hidden rounded-xl bg-layer-1/60 ring-1 ring-subtle @xl:grid-cols-4">
          <Fact label="Value" value={opportunityMoney(context.currency, context.input.value)} />
          <Fact label="Probability" value={`${detail.probability}%`}>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-layer-3">
              <span
                className="block h-full rounded-full bg-accent-primary"
                style={{ width: `${detail.probability}%` }}
              />
            </span>
          </Fact>
          <Fact label="Expected close" value={formatDate(detail.expectedCloseDate)} />
          <Fact label="Owner" value={owner || "Not assigned"} />
        </dl>

        <StageForm key={detail._id} detail={detail} canWrite={context.canWrite && !editing} />

        <Delivery workspace={workspace} opportunity={detail} />

        <div className="grid gap-4 @2xl:grid-cols-2">
          <OpportunityContacts workspace={workspace} detail={detail} client={context.client} />
          <MeetingActionItems workspace={workspace} opportunityId={detail._id} />
          <OpportunityPagesAndMeetings workspace={workspace} opportunityId={detail._id} />
          <DeliveryActivity workspace={workspace} opportunityId={detail._id} />
        </div>

        <section aria-labelledby={`create-from-${detail._id}`} className="grid gap-2">
          <h3 id={`create-from-${detail._id}`} className="text-12 font-semibold text-primary">
            Create from this opportunity
          </h3>
          <div className="flex flex-wrap gap-2">
            <ActionLink href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=proposal`} icon={FileText}>
              Proposal
            </ActionLink>
            <ActionLink
              href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=quotation`}
              icon={ReceiptText}
            >
              Quotation
            </ActionLink>
            <ActionLink href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=mom`} icon={NotebookPen}>
              Meeting notes
            </ActionLink>
            <ActionLink
              href={`/${workspaceSlug}/summon/automation?${automationQuery}&intent=presentation`}
              icon={Presentation}
            >
              Presentation
            </ActionLink>
            <ActionLink href={`/${workspaceSlug}/summon/assistant/`} icon={Sparkles}>
              Open Assistant
            </ActionLink>
          </div>
        </section>
      </article>
      {editing && (
        <OpportunityForm
          workspaceId={workspace._id}
          context={context}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function OpportunityContacts({
  workspace,
  detail,
  client,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  detail: Doc<"opportunities">;
  client: FunctionReturnType<typeof api.commercial.opportunities.get>["client"];
}) {
  const workspaceSlug = workspace.slug;
  const contactsPage = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { opportunityId: detail._id }, kind: "contacts" },
    { initialNumItems: 5 }
  );
  const contacts = contactsPage.results.filter((row) => row.kind === "contact").map((row) => row.contact);
  const primaryContact = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  return (
    <>
      <Section title="About">
        <p className="text-12 leading-5 text-pretty text-secondary">{detail.description || "No description yet."}</p>
        <dl className="mt-3 grid gap-2">
          <Row label="Product" value={detail.product || "Not set"} />
          <Row label="Source" value={detail.source || "Not set"} />
          <Row label="Primary contact" value={primaryContact?.name || "Not set"} />
          <Row label="Created" value={formatDate(detail._creationTime)} />
        </dl>
      </Section>

      <Section
        query={contactsPage}
        title="Contacts"
        action={
          client && !client.deleted ? (
            <InlineLink href={`/${workspaceSlug}/summon/clients/${client._id}/`}>Open client</InlineLink>
          ) : undefined
        }
      >
        <ul className="grid gap-1">
          {contacts.map((contact) => (
            <li key={contact._id} className="flex items-center gap-3 py-1">
              <span
                aria-hidden
                className="grid size-8 flex-none place-items-center rounded-full bg-layer-2 text-11 font-semibold text-secondary"
              >
                {initials(contact.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-12 font-medium text-primary">{contact.name}</span>
                <span className="block truncate text-11 text-secondary">{contact.title || "Contact"}</span>
              </span>
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  aria-label={`Email ${contact.name}`}
                  className="grid size-10 place-items-center rounded-lg text-accent-primary hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-accent-strong"
                >
                  <Mail className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        {contactsPage.status === "Exhausted" && !contacts.length ? <Empty>No client contacts.</Empty> : null}
      </Section>
    </>
  );
}
function MeetingActionItems({
  workspace,
  opportunityId,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  opportunityId: Doc<"opportunities">["_id"];
}) {
  const workspaceSlug = workspace.slug;
  const workItemsPage = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { opportunityId }, kind: "workItems" },
    { initialNumItems: 5 }
  );
  const workItems = workItemsPage.results.filter((row) => row.kind === "workItem");
  return (
    <Section title="Meeting action items" query={workItemsPage}>
      <ul className="grid gap-1">
        {workItems.map((item) => (
          <li key={item.link._id}>
            <Link
              href={generateWorkItemLink({
                workspaceSlug,
                projectId: item.project._id,
                issueId: item.task._id,
                projectIdentifier: item.project.identifier,
                sequenceId: item.task.sequence,
                isArchived: item.task.archivedAt !== null,
              })}
              className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
            >
              <span
                aria-hidden
                className={`size-3.5 flex-none rounded-full border-2 ${item.task.status === "done" ? "border-success-strong bg-success-primary" : "border-strong"}`}
              />
              <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">{item.task.title}</span>
              <span className="text-11 text-secondary">
                {item.project.identifier}-{item.task.sequence}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {workItemsPage.status === "Exhausted" && !workItems.length ? (
        <Empty>No action items from delivery meetings.</Empty>
      ) : null}
    </Section>
  );
}
function OpportunityPagesAndMeetings({
  workspace,
  opportunityId,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  opportunityId: Doc<"opportunities">["_id"];
}) {
  const workspaceSlug = workspace.slug;
  const scope = { opportunityId };
  const documentsPage = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope, kind: "allDocuments" },
    { initialNumItems: 4 }
  );
  const meetingsPage = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope, kind: "meetings" },
    { initialNumItems: 4 }
  );
  const documents = documentsPage.results.filter((row) => row.kind === "document");
  const meetings = meetingsPage.results.filter((row) => row.kind === "meeting").map((row) => row.meeting);
  return (
    <Section title="Pages and meetings" query={documentsPage} secondaryQuery={meetingsPage}>
      <ul className="grid gap-1">
        {documents.map((row) => {
          const content = (
            <>
              <FileText className="size-4 flex-none text-accent-primary" />
              <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">
                {row.document.name || "Untitled page"}
              </span>
              <span className="text-11 text-secondary">{row.document.category}</span>
            </>
          );
          return (
            <li key={row.document._id}>
              {row.project ? (
                <Link
                  href={`/${workspaceSlug}/projects/${row.project._id}/pages/${row.document._id}/`}
                  className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
                >
                  {content}
                </Link>
              ) : (
                <span className="flex min-h-10 items-center gap-3 px-2">{content}</span>
              )}
            </li>
          );
        })}
        {meetings.map((meeting) => (
          <li key={meeting._id}>
            <Link
              href={`/${workspaceSlug}/summon/meetings/${meeting._id}/`}
              className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
            >
              <Video className="size-4 flex-none text-accent-primary" />
              <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">{meeting.title}</span>
              <span className="text-11 text-secondary">{formatDate(meeting.startsAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {documentsPage.status === "Exhausted" &&
      meetingsPage.status === "Exhausted" &&
      !documents.length &&
      !meetings.length ? (
        <Empty>No linked pages or meetings.</Empty>
      ) : null}
    </Section>
  );
}
function DeliveryActivity({
  workspace,
  opportunityId,
}: {
  workspace: FunctionReturnType<typeof api.workspaces.index.list>[number];
  opportunityId: Doc<"opportunities">["_id"];
}) {
  const workspaceSlug = workspace.slug;
  const activityPage = usePaginatedQuery(
    api.commercial.clients.related,
    { workspaceId: workspace._id, scope: { opportunityId }, kind: "activity" },
    { initialNumItems: 5 }
  );
  const activity = activityPage.results.filter((row) => row.kind === "activity");
  return (
    <Section title="Recent delivery activity" className="@2xl:col-span-2" query={activityPage}>
      <ul className="grid gap-1">
        {activity.map((row) => (
          <li key={row.event._id}>
            <Link
              href={generateWorkItemLink({
                workspaceSlug,
                projectId: row.project._id,
                issueId: row.task._id,
                projectIdentifier: row.project.identifier,
                sequenceId: row.task.sequence,
                isArchived: row.task.archivedAt !== null,
              })}
              className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
            >
              <MessageSquare className="size-4 flex-none text-tertiary" />
              <span className="min-w-0 flex-1 truncate text-12 text-primary">{`${row.task.title}: ${row.event.kind.replaceAll("_", " ")}`}</span>
              <span className="text-11 text-secondary">{formatDate(row.event._creationTime)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {activityPage.status === "Exhausted" && !activity.length ? <Empty>No delivery activity yet.</Empty> : null}
    </Section>
  );
}

/** Pipeline position at a glance; a lost deal ends the track rather than completing it. */
function StageTrack({ stage }: { stage: Doc<"opportunities">["stage"] }) {
  const steps = OPPORTUNITY_STAGES.filter((item) => item !== "lost");
  const lost = stage === "lost";
  const current = lost ? -1 : steps.findIndex((item) => item === stage);
  return (
    <ol aria-label="Pipeline progress" className="grid grid-cols-5 gap-1.5">
      {steps.map((item, index) => {
        const reached = !lost && index <= current;
        return (
          <li key={item} aria-current={item === stage ? "step" : undefined} className="min-w-0">
            <span
              className={`block h-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${reached ? OPPORTUNITY_STAGE_TONE[stage].bar : lost ? "bg-label-crimson-bg" : "bg-layer-3"}`}
            />
            <span
              className={`mt-1.5 hidden truncate text-11 @sm:block ${item === stage ? "font-semibold text-primary" : "text-secondary"}`}
            >
              {OPPORTUNITY_STAGE_LABEL[item]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StageForm({ detail, canWrite }: { detail: Doc<"opportunities">; canWrite: boolean }) {
  const transition = useMutation(api.commercial.opportunities.transition);
  const values = { stage: detail.stage, probability: detail.probability, updatedAt: detail.updatedAt };
  const form = useForm({ defaultValues: values });
  const continuation = useRef<
    ((receipt: FunctionReturnType<typeof api.commercial.opportunities.transition>) => void) | null
  >(null);
  const leave = useCallback(() => {
    continuation.current = null;
  }, []);
  const release = useReloadConfirmations(
    form.formState.isDirty || form.formState.isSubmitting,
    "The opportunity stage has unsaved changes or is still saving.",
    leave,
    form.formState.isSubmitting
  );
  useEffect(() => leave, [leave]);
  return (
    <form
      onSubmit={form.handleSubmit(async (data) => {
        continuation.current = (receipt) => form.reset(receipt);
        try {
          const receipt = await transition({
            workspaceId: detail.workspaceId,
            opportunityId: detail._id,
            expectedUpdatedAt: data.updatedAt,
            stage: data.stage,
            probability: data.probability,
          });
          release(() => {
            const complete = continuation.current;
            continuation.current = null;
            complete?.(receipt);
          });
        } catch (failure) {
          if (continuation.current !== null)
            form.setError("root", { type: "server", message: mutationMessage(failure) });
          continuation.current = null;
        }
      })}
      aria-label="Update stage"
      className="grid gap-3 rounded-xl p-3 ring-1 ring-subtle @sm:grid-cols-[minmax(0,1fr)_6.5rem_auto] @sm:items-end"
    >
      <fieldset className="contents" disabled={!canWrite || form.formState.isSubmitting}>
        <SummonField label="Stage">
          <Controller
            name="stage"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  const stage = OPPORTUNITY_STAGES.find((item) => item === value);
                  if (stage) field.onChange(stage);
                }}
                className="h-10"
                disabled={!canWrite || form.formState.isSubmitting}
                options={OPPORTUNITY_STAGES.map((value) => ({ value, label: OPPORTUNITY_STAGE_LABEL[value] }))}
              />
            )}
          />
        </SummonField>
        <SummonField label="Probability (%)">
          <Input
            {...form.register("probability", { valueAsNumber: true })}
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="numeric"
            className="h-10 tabular-nums"
          />
        </SummonField>
        <Button
          type="submit"
          size="xl"
          className="h-10"
          disabled={!form.formState.isDirty}
          loading={form.formState.isSubmitting}
        >
          Save stage
        </Button>
        {(form.formState.isDirty || detail.updatedAt !== form.getValues("updatedAt")) && (
          <Button type="button" variant="secondary" onClick={() => form.reset(values)} className="@sm:col-span-3">
            Reset stage
          </Button>
        )}
      </fieldset>
      {form.formState.errors.root?.message && (
        <p role="alert" className="text-12 text-danger-primary @sm:col-span-3">
          {form.formState.errors.root.message}
        </p>
      )}
    </form>
  );
}

function Fact(props: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 p-3 odd:border-r odd:border-subtle @xl:border-r @xl:border-subtle @xl:last:border-r-0">
      <dt className="text-11 text-secondary">{props.label}</dt>
      <dd className="mt-1 truncate text-13 font-semibold text-primary tabular-nums">{props.value}</dd>
      {props.children}
    </div>
  );
}

function Section(props: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  query?: ReturnType<typeof usePaginatedQuery<typeof api.commercial.clients.related>>;
  secondaryQuery?: ReturnType<typeof usePaginatedQuery<typeof api.commercial.clients.related>>;
}) {
  return (
    <section className={`min-w-0 rounded-xl p-3.5 ring-1 ring-subtle ${props.className ?? ""}`}>
      <header className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <h3 className="text-12 font-semibold text-primary">{props.title}</h3>
        {props.action}
      </header>
      {props.children}
      {Object.entries({ primary: props.query, secondary: props.secondaryQuery }).map(
        ([kind, query]) =>
          query && (
            <div key={kind} className="mt-2">
              {(query.status === "LoadingFirstPage" || query.status === "LoadingMore") && (
                <p role="status" className="text-11 text-secondary">
                  Loading {kind === "secondary" ? "meetings" : props.title.toLowerCase()}…
                </p>
              )}
              {query.status === "CanLoadMore" && (
                <Button type="button" size="sm" variant="secondary" onClick={() => query.loadMore(5)}>
                  Load more {kind === "secondary" ? "meetings" : props.title.toLowerCase()}
                </Button>
              )}
            </div>
          )
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 text-12">
      <dt className="text-secondary">{label}</dt>
      <dd className="truncate font-medium text-primary">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-12 text-tertiary">{children}</p>;
}

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative text-11 font-medium text-accent-primary after:absolute after:-inset-x-2 after:-inset-y-3 hover:underline focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      {children} →
    </Link>
  );
}

function ActionLink(props: { href: string; icon: typeof FileText; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-12 font-medium text-primary ring-1 ring-subtle transition-[background-color,scale] hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-accent-strong active:scale-[0.96] motion-reduce:transition-none"
    >
      <Icon className="size-4 text-accent-primary" />
      {props.children}
    </Link>
  );
}
