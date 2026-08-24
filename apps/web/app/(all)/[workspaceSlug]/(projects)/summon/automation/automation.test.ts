import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../../../../../core/services/summon.service.ts", import.meta.url), "utf8");
const markdownRenderer = readFileSync(
  new URL("../../../../../../core/components/ui/markdown-to-component.tsx", import.meta.url),
  "utf8"
);
const {
  automationInputValue,
  buildAutomationInput,
  filterAutomationJobs,
  isMultilineTemplateVariable,
  syncTemplateVariableValues,
} = await import(new URL("./automation-form.ts", import.meta.url).href);

test("Automation previews before an explicit idempotent publish", () => {
  assert.match(service, /generateAutomationPreview/);
  assert.match(service, /publishAutomationJob/);
  assert.match(source, /preview_markdown/);
  assert.match(source, /Publish to Plane Page/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /page_detail/);
  assert.match(source, /Select Plane Project/);
  assert.match(source, /canGeneratePreview/);
  assert.doesNotMatch(source, /Workspace Page/);
});

test("Automation renders generated previews as GitHub-flavored Markdown", () => {
  assert.match(source, /<MarkdownRenderer markdown=\{selectedJob\.preview_markdown\}/);
  assert.doesNotMatch(source, /<pre[^>]*>[\s\S]*selectedJob\.preview_markdown/);
  assert.match(markdownRenderer, /remarkPlugins=\{\[remarkGfm\]\}/);
});

test("Automation exposes explicit context, citations, metadata, and retry state", () => {
  assert.match(source, /workspaceContext/);
  assert.match(source, /pageIds/);
  assert.match(source, /citations/);
  assert.match(source, /context_truncated/);
  assert.match(source, /provider/);
  assert.match(source, /model/);
  assert.match(source, /Retry preview/);
  assert.doesNotMatch(source, /apiKey|LLM_API_KEY|credential.*secret/i);
});

test("Automation accepts local documents as additional verified context", () => {
  assert.match(service, /extractAutomationContext/);
  assert.match(source, /accept="\.pdf,\.docx,\.xlsx,\.pptx,\.txt,\.md,\.csv"/);
  assert.match(source, /Document: \$\{extracted\.name\}/);
  assert.match(source, /Meeting \/ audio transcript/);
});

test("Automation renders editable files without coupling them to Plane Page publishing", () => {
  assert.match(service, /renderAutomationJob/);
  assert.match(service, /\/api\/workspaces\/\$\{workspaceSlug\}\/summon\/automation-jobs\/\$\{jobId\}\/render\//);
  assert.match(source, /AI Document Generator/);
  assert.match(source, /Generate files/);
  assert.match(source, /editable office files and PDF/);
  assert.match(source, /file_detail/);
  assert.match(source, /download/);
  assert.match(source, /docx: "DOCX"/);
  assert.match(source, /xlsx: "XLSX"/);
  assert.match(source, /pptx: "PPTX"/);
  assert.match(source, /data\?\.templates\.map/);
  assert.match(source, /pageArtifact/);
  assert.match(source, /fileArtifacts/);
  assert.doesNotMatch(source, /disabled=\{[^}]*artifacts\.length/);
  assert.match(source, /\["presentation", "proposal_vendor", "proposal_client"\]/);
});

test("Automation invalidates stale previews and publishes the selected job snapshot", () => {
  assert.match(source, /previewDirty/);
  assert.match(source, /setPreviewDirty\(true\)/);
  assert.match(source, /setPreviewDirty\(false\)/);
  assert.match(source, /submittedVersion === draftVersion\.current/);
  assert.match(source, /hasValidPreview/);
  assert.match(source, /selectedJob\.input/);
  assert.match(source, /aria-pressed=\{selectedJob\?\.id === job\.id\}/);
  assert.doesNotMatch(source, /setActiveJob\(job\);\s+setPreviewDirty\(false\)/);
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
