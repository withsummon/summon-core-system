import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSources = (...paths: string[]) =>
  paths.map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
// The screens are split into focused modules; assert against the page plus its extracted parts.
const source = readSources(
  "./page.tsx",
  "./automation-display.ts",
  "./automation-generator-form.tsx",
  "./automation-jobs-table.tsx",
  "./automation-template-grid.tsx",
  "./use-automation-generator.ts"
);
const detailSource = readSources("./[jobId]/page.tsx", "./[jobId]/job-detail-panels.tsx", "./automation-display.ts");
const routes = readFileSync(new URL("../../../../../routes/extended.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../../../core/services/summon.service.ts", import.meta.url), "utf8");
const markdownRenderer = readFileSync(
  new URL("../../../../../../core/components/ui/markdown-to-component.tsx", import.meta.url),
  "utf8"
);
const {
  automationInputValue,
  automationJobPath,
  buildAutomationInput,
  filterAutomationJobs,
  isMultilineTemplateVariable,
  meetingTranscriptReady,
  syncTemplateVariableValues,
} = await import(new URL("./automation-form.ts", import.meta.url).href);

test("Automation previews before an explicit idempotent publish", () => {
  assert.match(detailSource, /preview_markdown/);
  assert.match(detailSource, /Publish as page/);
  assert.match(detailSource, /window\.confirm/);
  assert.match(detailSource, /page_detail/);
  assert.match(source, /Select project/);
  assert.match(source, /canGeneratePreview/);
  assert.doesNotMatch(source, /Workspace Page/);
});

test("Automation renders generated previews as GitHub-flavored Markdown", () => {
  assert.match(detailSource, /<MarkdownRenderer markdown=\{data\.preview_markdown\}/);
  assert.doesNotMatch(detailSource, /<pre[^>]*>[\s\S]*data\.preview_markdown/);
  assert.match(markdownRenderer, /remarkPlugins=\{\[remarkGfm\]\}/);
});

test("Generated document actions navigate to a dedicated detail page", () => {
  assert.equal(automationJobPath?.("core", "job-123"), "/core/summon/automation/job-123/");
  assert.match(routes, /summon\/automation\/:jobId/);
  assert.match(source, /href=\{automationJobPath\(workspaceSlug, job\.id\)\}/);
  assert.doesNotMatch(source, /scrollIntoView|detailsOpen|detailsRef/);
});

test("Automation exposes explicit context, citations, metadata, and retry state", () => {
  assert.match(source, /workspaceContext/);
  assert.match(source, /pageIds/);
  assert.match(detailSource, /citations/);
  assert.match(detailSource, /context_truncated/);
  assert.match(detailSource, /provider/);
  assert.match(detailSource, /model/);
  assert.match(detailSource, /onRetry/);
  assert.doesNotMatch(`${source}\n${detailSource}`, /apiKey|LLM_API_KEY|credential.*secret/i);
});

test("Automation accepts local documents as additional verified context", () => {
  assert.match(source, /accept="\.pdf,\.docx,\.xlsx,\.pptx,\.txt,\.md,\.csv"/);
  assert.match(source, /Document: \$\{extracted\.name\}/);
  assert.match(source, /Meeting \/ audio transcript/);
});

test("Automation waits for a selected meeting audio transcript before generating", () => {
  assert.equal(meetingTranscriptReady?.(undefined), true);
  assert.equal(meetingTranscriptReady?.({ summary_error: "transcribing", transcript_text: "" }), false);
  assert.equal(meetingTranscriptReady?.({ summary_error: "transcription_failed", transcript_text: "" }), false);
  assert.equal(meetingTranscriptReady?.({ summary_error: "", transcript_text: "Keputusan disetujui." }), true);
});

test("Automation renders editable files without coupling them to Plane Page publishing", () => {
  assert.match(service, /\/api\/workspaces\/\$\{workspaceSlug\}\/summon\/automation-jobs\/\$\{jobId\}\/render\//);
  assert.match(source, /Generate a document/);
  assert.match(detailSource, /Generate files/);
  assert.match(detailSource, /file_detail/);
  assert.match(detailSource, /download/);
  assert.match(detailSource, /docx: "DOCX"/);
  assert.match(detailSource, /xlsx: "XLSX"/);
  assert.match(detailSource, /pptx: "PPTX"/);
  assert.match(source, /\(data\?\.templates \?\? \[\]\)\.map/);
  assert.match(detailSource, /pageArtifact/);
  assert.match(detailSource, /fileArtifacts/);
  assert.doesNotMatch(detailSource, /disabled=\{[^}]*artifacts\.length/);
  assert.match(source, /\["presentation", "proposal_vendor", "proposal_client"\]/);
});

test("Automation detail reloads and publishes the persisted job snapshot", () => {
  assert.match(detailSource, /summonService\.getAutomationJob\(workspaceSlug, jobId\)/);
  assert.match(detailSource, /publishAutomationJob\(workspaceSlug, data\.id\)/);
  assert.match(detailSource, /automationInputValue\(data\.input, "title"\)/);
  assert.doesNotMatch(source, /previewDirty|selectedJob|setActiveJob/);
});

test("Automation consumes template variables through one reusable input mapping", () => {
  assert.match(source, /templateVariables/);
  assert.match(source, /variableValues/);
  assert.match(source, /buildAutomationInput/);
  assert.match(source, /selectedTemplate\?\.variables/);
  assert.match(source, /Document fields \(Optional\)/);
  assert.doesNotMatch(source, /templateVariables\.every/);
});

test("Template examples preserve shared values and send every required variable", () => {
  const proposalVariables = ["title", "client", "request", "scope", "timeline", "resources", "pricing"];
  const uatVariables = ["title", "project", "client", "document_number", "version", "test_period", "test_cases"];
  const proposalValues = syncTemplateVariableValues(proposalVariables, {
    client: "Summon",
    request: "Document generator",
    scope: "Reporting",
    timeline: "Q3",
    resources: "Product team",
    pricing: "IDR 10,000,000",
    stale: "remove me",
  });

  assert.deepEqual(buildAutomationInput(proposalVariables, "Vendor proposal", "Use cited context", proposalValues), {
    title: "Vendor proposal",
    brief: "Use cited context",
    client: "Summon",
    request: "Document generator",
    scope: "Reporting",
    timeline: "Q3",
    resources: "Product team",
    pricing: "IDR 10,000,000",
  });

  assert.deepEqual(syncTemplateVariableValues(uatVariables, proposalValues), {
    project: "",
    client: "Summon",
    document_number: "",
    version: "",
    test_period: "",
    test_cases: "",
  });
  assert.equal(automationInputValue({ values: { title: "Persisted snapshot" } }, "title"), "Persisted snapshot");
});

test("Structured template variables use multiline fields without per-template branching", () => {
  assert.equal(isMultilineTemplateVariable("items"), true);
  assert.equal(isMultilineTemplateVariable("bugs"), true);
  assert.equal(isMultilineTemplateVariable("key_points"), true);
  assert.equal(isMultilineTemplateVariable("due_date"), false);
  assert.match(source, /isMultilineTemplateVariable\(variable\)/);
  assert.match(source, /Enter one item per line or structured details/);
});

test("Generated document search matches persisted titles, types, and project context", () => {
  const jobs = [
    {
      id: "proposal",
      type: "technical_proposal",
      project: "project-bsb",
      input: { title: "Technical Proposal" },
    },
    {
      id: "minutes",
      type: "mom",
      project: "project-sanf",
      input: { title: "Weekly Review" },
    },
  ];
  const projectNames = new Map([
    ["project-bsb", "Logistic Management"],
    ["project-sanf", "Credit Scoring"],
  ]);

  assert.deepEqual(
    filterAutomationJobs(jobs, projectNames, "logistic", "all").map((job: { id: string }) => job.id),
    ["proposal"]
  );
  assert.deepEqual(
    filterAutomationJobs(jobs, projectNames, "", "mom").map((job: { id: string }) => job.id),
    ["minutes"]
  );
  assert.deepEqual(filterAutomationJobs(jobs, projectNames, "missing", "all"), []);
});
