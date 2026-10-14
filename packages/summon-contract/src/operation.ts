/** One Summon endpoint the AI service may expose as a tool (see `x-summon-tool` in the Django schema). */
export interface SummonOperation {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** OpenAPI path template, e.g. `/api/summon/workspaces/{slug}/meetings/{pk}/`. */
  readonly path: string;
  /** `read`: safe to call without asking. `write`: changes data, so clients should confirm first. */
  readonly tool: "read" | "write";
  /** Short name for people, e.g. "List clients" (the OpenAPI summary). */
  readonly title: string;
  readonly description: string;
  /** The Django view module it belongs to (`commercial`, `collaboration`, …), so clients can load some groups. */
  readonly toolset: string;
  /** Whether it answers a JSON array, which the AI service pages through. */
  readonly list: boolean;
  readonly pathParams: ReadonlyArray<string>;
  readonly queryParams: ReadonlyArray<string>;
  /** `flat`: body fields are top-level input properties. `nested`: the body is `input.body`. */
  readonly body: "flat" | "nested" | null;
  /** JSON Schema 2020-12 for the tool input, without the workspace slug (bound from the caller). */
  readonly inputSchema: { readonly type: "object" } & Readonly<Record<string, unknown>>;
}
