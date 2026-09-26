import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Building2,
  Check,
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
import type { ISummonOpportunityDetail, TSummonOpportunityStage } from "@plane/types";
import { SummonField } from "@/components/summon/forms";
import { summonErrorMessage } from "@/components/summon/screen";
import { useMember } from "@/hooks/store/use-member";
import { summonService } from "@/services/summon.service";
import { DeliveryHandoffCard } from "./delivery-handoff-card";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, OPPORTUNITY_STAGE_TONE } from "./opportunity-pipeline";
import { Select } from "@plane/propel/select";

const formatDate = (value?: string | null) =>
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

export function useOpportunityMoney(workspaceSlug: string) {
  const { data: settings } = useSWR(["summon-opportunity-settings", workspaceSlug], () =>
    summonService.getWorkspaceSettings(workspaceSlug)
  );
  return (value: string | null) => {
    if (!value) return "Not set";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return value;
    try {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: settings?.currency || "IDR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return value;
    }
  };
}

export function StageChip({ stage }: { stage: TSummonOpportunityStage }) {
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

export const OpportunityInspector = observer(function OpportunityInspector(props: {
  workspaceSlug: string;
  detail: ISummonOpportunityDetail;
  onChanged: () => Promise<unknown>;
  backHref?: string;
  backClassName?: string;
}) {
  const { workspaceSlug, detail, onChanged } = props;
  const { getUserDetails } = useMember();
  const money = useOpportunityMoney(workspaceSlug);
  const owner = detail.owner ? getUserDetails(detail.owner)?.display_name : undefined;
  const automationQuery = new URLSearchParams({
    opportunity: detail.id,
    client: detail.client ?? "",
    context: detail.title,
  }).toString();
  const primaryContact = detail.contacts.find((contact) => contact.is_primary) ?? detail.contacts[0];

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
      <article className="@container flex min-w-0 flex-col gap-4" aria-labelledby={`opportunity-${detail.id}`}>
        <header className="flex flex-wrap items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 flex-none place-items-center rounded-xl bg-accent-subtle text-13 font-semibold text-accent-primary"
          >
            {initials(detail.title)}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={`opportunity-${detail.id}`}
              className="text-18 leading-snug font-semibold text-balance text-primary"
            >
              {detail.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-secondary">
              {detail.client_detail ? (
                <Link
                  href={`/${workspaceSlug}/summon/clients/${detail.client_detail.id}/`}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:text-accent-primary hover:underline"
                >
                  <Building2 className="size-3.5" />
                  {detail.client_detail.company_name || detail.client_detail.name}
                </Link>
              ) : (
                <span>No client</span>
              )}
              <span aria-hidden>·</span>
              <span>Updated {formatDate(detail.updated_at)}</span>
            </p>
          </div>
          <StageChip stage={detail.stage} />
        </header>

        <StageTrack stage={detail.stage} />

        <dl className="grid grid-cols-2 overflow-hidden rounded-xl bg-layer-1/60 ring-1 ring-subtle @xl:grid-cols-4">
          <Fact label="Value" value={money(detail.value)} />
          <Fact label="Probability" value={`${detail.probability}%`}>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-layer-3">
              <span
                className="block h-full rounded-full bg-accent-primary"
                style={{ width: `${detail.probability}%` }}
              />
            </span>
          </Fact>
          <Fact label="Expected close" value={formatDate(detail.expected_close_date)} />
          <Fact label="Owner" value={owner || "Not assigned"} />
        </dl>

        <StageForm key={detail.id} workspaceSlug={workspaceSlug} detail={detail} onChanged={onChanged} />

        <DeliveryHandoffCard workspaceSlug={workspaceSlug} opportunity={detail} onChanged={onChanged} />

        <div className="grid gap-4 @2xl:grid-cols-2">
          <Section title="About">
            <p className="text-12 leading-5 text-pretty text-secondary">
              {detail.description || "No description yet."}
            </p>
            <dl className="mt-3 grid gap-2">
              <Row label="Product" value={detail.product || "Not set"} />
              <Row label="Source" value={detail.source || "Not set"} />
              <Row label="Primary contact" value={primaryContact?.name || "Not set"} />
              <Row label="Created" value={formatDate(detail.created_at)} />
            </dl>
          </Section>

          <Section
            title="Contacts"
            action={
              detail.client_detail ? (
                <InlineLink href={`/${workspaceSlug}/summon/clients/${detail.client_detail.id}/`}>
                  Open client
                </InlineLink>
              ) : undefined
            }
          >
            <ul className="grid gap-1">
              {detail.contacts.slice(0, 5).map((contact) => (
                <li key={contact.id} className="flex items-center gap-3 py-1">
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
            {!detail.contacts.length ? <Empty>No client contacts.</Empty> : null}
          </Section>

          <Section title="Meeting action items">
            <ul className="grid gap-1">
              {detail.work_items.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/${workspaceSlug}/projects/${item.issue.project.id}/issues/${item.issue.id}/`}
                    className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
                  >
                    <span
                      aria-hidden
                      className={`size-3.5 flex-none rounded-full border-2 ${item.issue.completed ? "border-success-strong bg-success-primary" : "border-strong"}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">{item.issue.name}</span>
                    <span className="text-11 text-secondary">
                      {item.issue.project.identifier}-{item.issue.sequence_id}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {!detail.work_items.length ? <Empty>No action items from delivery meetings.</Empty> : null}
          </Section>

          <Section title="Pages and meetings">
            <ul className="grid gap-1">
              {detail.page_contexts.slice(0, 4).map((context) => {
                const content = (
                  <>
                    <FileText className="size-4 flex-none text-accent-primary" />
                    <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">
                      {context.page_detail.name || "Untitled page"}
                    </span>
                    <span className="text-11 text-secondary">{context.category}</span>
                  </>
                );
                return (
                  <li key={context.id}>
                    {context.project ? (
                      <Link
                        href={`/${workspaceSlug}/projects/${context.project}/pages/${context.page}/`}
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
              {detail.meetings.slice(0, 4).map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/${workspaceSlug}/summon/meetings/${meeting.id}/`}
                    className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
                  >
                    <Video className="size-4 flex-none text-accent-primary" />
                    <span className="min-w-0 flex-1 truncate text-12 font-medium text-primary">{meeting.title}</span>
                    <span className="text-11 text-secondary">{formatDate(meeting.starts_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!detail.page_contexts.length && !detail.meetings.length ? (
              <Empty>No linked pages or meetings.</Empty>
            ) : null}
          </Section>

          <Section title="Recent delivery activity" className="@2xl:col-span-2">
            <ul className="grid gap-1">
              {detail.recent_activity.slice(0, 5).map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={activity.href}
                    className="flex min-h-10 items-center gap-3 rounded-lg px-2 hover:bg-layer-1"
                  >
                    <MessageSquare className="size-4 flex-none text-tertiary" />
                    <span className="min-w-0 flex-1 truncate text-12 text-primary">{activity.label}</span>
                    <span className="text-11 text-secondary">{formatDate(activity.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {!detail.recent_activity.length ? <Empty>No delivery activity yet.</Empty> : null}
          </Section>
        </div>

        <section aria-labelledby={`create-from-${detail.id}`} className="grid gap-2">
          <h3 id={`create-from-${detail.id}`} className="text-12 font-semibold text-primary">
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
    </div>
  );
});

/** Pipeline position at a glance; a lost deal ends the track rather than completing it. */
function StageTrack({ stage }: { stage: TSummonOpportunityStage }) {
  const steps = OPPORTUNITY_STAGES.filter((item) => item !== "lost");
  const lost = stage === "lost";
  const current = lost ? -1 : steps.indexOf(stage);
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

function StageForm(props: {
  workspaceSlug: string;
  detail: ISummonOpportunityDetail;
  onChanged: () => Promise<unknown>;
}) {
  const { workspaceSlug, detail, onChanged } = props;
  const [stage, setStage] = useState<TSummonOpportunityStage>(detail.stage);
  const [probability, setProbability] = useState(String(detail.probability));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const probabilityValue = Number(probability);
  const probabilityValid =
    probability !== "" && Number.isInteger(probabilityValue) && probabilityValue >= 0 && probabilityValue <= 100;
  const changed = stage !== detail.stage || probabilityValue !== detail.probability;

  // Follow the persisted values after a save or refetch without remounting, so the saved status stays visible.
  useEffect(() => {
    setStage(detail.stage);
    setProbability(String(detail.probability));
  }, [detail.stage, detail.probability]);

  useEffect(() => {
    if (status !== "saved") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed || !probabilityValid || status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      await summonService.transitionOpportunity(workspaceSlug, detail.id, { stage, probability: probabilityValue });
      await onChanged();
      setStatus("saved");
    } catch (requestError) {
      setError(summonErrorMessage(requestError));
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={save}
      aria-label="Update stage"
      className="grid gap-3 rounded-xl p-3 ring-1 ring-subtle @sm:grid-cols-[minmax(0,1fr)_6.5rem_auto] @sm:items-end"
    >
      <SummonField label="Stage">
        <Select
          value={stage}
          onValueChange={(value) => setStage(value as TSummonOpportunityStage)}
          className="h-10"
          options={OPPORTUNITY_STAGES.map((item) => ({ value: item, label: OPPORTUNITY_STAGE_LABEL[item] }))}
        />
      </SummonField>
      <SummonField label="Probability (%)">
        <Input
          type="number"
          min="0"
          max="100"
          step="1"
          inputMode="numeric"
          value={probability}
          onChange={(event) => setProbability(event.target.value)}
          hasError={!probabilityValid}
          className="h-10 tabular-nums"
        />
      </SummonField>
      <Button
        type="submit"
        size="xl"
        className="h-10"
        disabled={!changed || !probabilityValid}
        loading={status === "saving"}
      >
        Save stage
      </Button>
      <p aria-live="polite" className="min-h-4 text-12 @sm:col-span-3">
        {status === "saved" ? (
          <span className="inline-flex items-center gap-1 text-success-primary">
            <Check className="size-3.5" /> Stage saved
          </span>
        ) : status === "error" ? (
          <span className="text-danger-primary">{error}</span>
        ) : !probabilityValid ? (
          <span className="text-danger-primary">Enter a whole number from 0 to 100.</span>
        ) : null}
      </p>
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

function Section(props: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl p-3.5 ring-1 ring-subtle ${props.className ?? ""}`}>
      <header className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <h3 className="text-12 font-semibold text-primary">{props.title}</h3>
        {props.action}
      </header>
      {props.children}
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
