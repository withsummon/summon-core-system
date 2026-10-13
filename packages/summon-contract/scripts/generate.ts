/**
 * Generates the TypeScript side of the Summon contract from `openapi.json` (written by Django, see
 * `scripts/schema.sh`):
 *
 * - `src/client.gen.ts`: the Effect HTTP client (`@effect/openapi-generator`), one typed method per operation.
 * - `src/operations.gen.ts`: every operation Django marks as a tool (`x-summon-tool` read or write), with its
 *   HTTP route and a self-contained JSON Schema for the tool input. The AI service builds assistant tools and
 *   MCP tools from it, so a Django serializer change reaches both without hand-written schemas.
 *
 * Run `bun run generate:client`; CI runs `check:generated` and fails on a diff.
 */
import { $ } from "bun";
import path from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema: JsonObject;
}

interface OpenApiOperation {
  operationId: string;
  description?: string;
  parameters?: OpenApiParameter[];
  requestBody?: { required?: boolean; content: Record<string, { schema: JsonObject }> };
  "x-summon-tool": "read" | "write" | "none";
}

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { schemas: Record<string, JsonObject> };
}

const root = path.resolve(import.meta.dir, "..");
const spec = (await Bun.file(path.join(root, "openapi.json")).json()) as OpenApiDocument;
const REF_PREFIX = "#/components/schemas/";
// The workspace comes from the caller's session or API key, never from the model.
const BOUND_PARAMS = new Set(["slug"]);

/** OpenAPI 3.1 schema (already JSON Schema 2020-12) → a standalone tool schema: refs point at `$defs`. */
function toJsonSchema(schema: Json, refs: Set<string>): Json {
  if (Array.isArray(schema)) return schema.map((item) => toJsonSchema(item, refs));
  if (schema === null || typeof schema !== "object") return schema;
  const { readOnly: _readOnly, ...rest } = schema;
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(rest)) {
    if (key.startsWith("x-")) continue;
    if (key === "$ref" && typeof value === "string" && value.startsWith(REF_PREFIX)) {
      const name = value.slice(REF_PREFIX.length);
      refs.add(name);
      out.$ref = `#/$defs/${name}`;
      continue;
    }
    out[key] =
      key === "properties" || key === "$defs" ? mapValues(value as JsonObject, refs) : toJsonSchema(value, refs);
  }
  return out;
}

function mapValues(object: JsonObject, refs: Set<string>): JsonObject {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toJsonSchema(value, refs)]));
}

/** Converts every component a schema reaches, so each tool schema stands alone. */
function withDefs(schema: JsonObject, refs: Set<string>): JsonObject {
  const defs: JsonObject = {};
  const pending = [...refs];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (name in defs) continue;
    const nested = new Set<string>();
    defs[name] = toJsonSchema(spec.components.schemas[name]!, nested);
    pending.push(...[...nested].filter((ref) => !(ref in defs)));
  }
  const sorted = Object.fromEntries(Object.entries(defs).toSorted(([a], [b]) => a.localeCompare(b)));
  return Object.keys(sorted).length > 0 ? { ...schema, $defs: sorted } : schema;
}

function resolve(schema: JsonObject): JsonObject {
  const ref = schema.$ref;
  return typeof ref === "string" ? spec.components.schemas[ref.slice(REF_PREFIX.length)]! : schema;
}

interface GeneratedOperation {
  method: string;
  path: string;
  tool: "read" | "write";
  description: string;
  pathParams: string[];
  queryParams: string[];
  body: "flat" | "nested" | null;
  inputSchema: JsonObject;
}

function operation(method: string, route: string, op: OpenApiOperation): GeneratedOperation {
  const refs = new Set<string>();
  const properties: JsonObject = {};
  const required: string[] = [];
  const params = (op.parameters ?? []).filter((param) => param.in === "path" || param.in === "query");
  for (const param of params) {
    if (BOUND_PARAMS.has(param.name)) continue;
    const schema = toJsonSchema(param.schema, refs) as JsonObject;
    properties[param.name] = param.description ? { ...schema, description: param.description } : schema;
    if (param.required) required.push(param.name);
  }

  let body: GeneratedOperation["body"] = null;
  const bodySchema = op.requestBody?.content["application/json"]?.schema;
  if (bodySchema) {
    const resolved = resolve(bodySchema);
    const fields = resolved.properties as JsonObject | undefined;
    const collides = fields && Object.keys(fields).some((name) => name in properties);
    if (resolved.type === "object" && fields && !collides) {
      // Flat: body fields sit next to the path and query params, which is what models handle best.
      body = "flat";
      Object.assign(properties, mapValues(fields, refs));
      required.push(...((resolved.required as string[] | undefined) ?? []));
    } else {
      body = "nested";
      properties.body = toJsonSchema(bodySchema, refs);
      if (op.requestBody?.required) required.push("body");
    }
  }

  const input: JsonObject = { type: "object", properties, additionalProperties: false };
  if (required.length > 0) input.required = required;
  return {
    method: method.toUpperCase(),
    path: route,
    tool: op["x-summon-tool"] as "read" | "write",
    description: op.description ?? "",
    pathParams: params.filter((param) => param.in === "path").map((param) => param.name),
    queryParams: params.filter((param) => param.in === "query").map((param) => param.name),
    body,
    inputSchema: withDefs(input, refs),
  };
}

const operations: Record<string, GeneratedOperation> = {};
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (op["x-summon-tool"] === "none") continue;
    if (!op.description) throw new Error(`${op.operationId} is a tool without a description`);
    operations[op.operationId] = operation(method, route, op);
  }
}

const header = "// Generated by scripts/generate.ts from openapi.json. Do not edit.\n";
const manifest = `${header}import type { SummonOperation } from "./operation";

export const operations = ${JSON.stringify(operations, null, 2)} as const satisfies Record<string, SummonOperation>;

export type SummonOperationId = keyof typeof operations;
`;
await Bun.write(path.join(root, "src/operations.gen.ts"), manifest);

const client = await $`openapigen --spec ${path.join(root, "openapi.json")} --name SummonClient`.cwd(root).text();
await Bun.write(path.join(root, "src/client.gen.ts"), `${header}${client}`);

await $`oxfmt src/operations.gen.ts src/client.gen.ts`.cwd(root).quiet();
console.log(`summon-contract: ${Object.keys(operations).length} tool operations, client regenerated`);
