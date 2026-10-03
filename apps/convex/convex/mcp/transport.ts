import { isObject, redact } from "./tools";
const supportedVersions = ["2025-11-25", "2025-06-18", "2025-03-26"];
export function endpoint() {
  const value = process.env.SUMMON_MCP_URL;
  if (!value) throw new Error("MCP endpoint is not configured.");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error("Invalid MCP endpoint configuration.");
  return url.toString();
}
function matchingResponse(data: string, id: number) {
  const value: unknown = JSON.parse(data);
  if (!isObject(value) || value.jsonrpc !== "2.0") throw new Error("MCP returned an invalid response.");
  if (value.id !== id) return null;
  if (value.error) throw new Error("MCP tool failed.");
  if (!("result" in value)) throw new Error("MCP returned an invalid response.");
  return value;
}
// SSE line state survives chunk boundaries, including CRLF split across reads.
function sseResponse(id: number) {
  let line = "",
    data: string[] = [],
    skipLf = false;
  function endLine() {
    if (!line) {
      const event = data.join("\n");
      data = [];
      return event ? matchingResponse(event, id) : null;
    }
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    line = "";
    return null;
  }
  return (chunk: string) => {
    for (const character of chunk) {
      if (skipLf && character === "\n") {
        skipLf = false;
        continue;
      }
      skipLf = false;
      if (character === "\r" || character === "\n") {
        const value = endLine();
        if (value) return value;
        skipLf = character === "\r";
      } else line += character;
    }
    return null;
  };
}
async function payload(response: Response, id: number) {
  if (!response.ok || !response.body) throw new Error("MCP request failed.");
  const contentType = response.headers.get("content-type") ?? "";
  const streaming = contentType.includes("text/event-stream");
  if (!streaming && !contentType.includes("application/json"))
    throw new Error("MCP returned an unsupported response type.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder(),
    event = sseResponse(id);
  let text = "",
    size = 0;
  try {
    while (true) {
      // Ordered stream reads enforce the size bound and stop at the matching response.
      // oxlint-disable-next-line no-await-in-loop
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 1000000) throw new Error("MCP response exceeded its size limit.");
      const chunk = decoder.decode(next.value, { stream: true });
      if (streaming) {
        const value = event(chunk);
        if (value) return value;
      } else text += chunk;
    }
    const value = streaming ? event(decoder.decode()) : matchingResponse(text + decoder.decode(), id);
    if (!value) throw new Error("MCP stream ended without the requested response.");
    return value;
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export async function callTool(args: {
  url: string;
  secret: string;
  workspaceSlug: string;
  tool: string;
  argumentsJson: string;
  beforeDispatch: () => Promise<void>;
  onDispatch: () => void;
}) {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${args.secret}`,
    "Content-Type": "application/json",
    "X-Workspace-slug": args.workspaceSlug,
  };
  const post = (body: unknown, timeout: number) =>
    fetch(args.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
  const initialize = await post(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: supportedVersions[0],
        capabilities: {},
        clientInfo: { name: "summon-assistant", version: "2" },
      },
    },
    15000
  );
  const initialization = await payload(initialize, 1);
  if (
    !isObject(initialization.result) ||
    typeof initialization.result.protocolVersion !== "string" ||
    !supportedVersions.includes(initialization.result.protocolVersion)
  )
    throw new Error("MCP negotiated an unsupported protocol version.");
  headers["MCP-Protocol-Version"] = initialization.result.protocolVersion;
  const sessionId = initialize.headers.get("Mcp-Session-Id");
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const initialized = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, 15000);
  if (!initialized.ok) throw new Error("MCP initialization failed.");
  await initialized.body?.cancel();
  await args.beforeDispatch();
  args.onDispatch();
  const response = await payload(
    await post(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: args.tool, arguments: JSON.parse(args.argumentsJson) },
      },
      30000
    ),
    2
  );
  if (isObject(response.result) && response.result.isError === true) throw new Error("MCP tool reported a failure.");
  return JSON.stringify(redact(response.result, args.secret));
}
