import { describe, expect, it } from "vitest";
import { operations, type SummonOperation } from "../src";

const all: Readonly<Record<string, SummonOperation>> = operations;
const entries = Object.entries(all);

describe("tool operations", () => {
  it("covers the Summon API", () => {
    expect(entries.length).toBeGreaterThan(50);
  });

  it.each(entries)("%s has a description and a closed object input", (_, operation) => {
    expect(operation.description.length).toBeGreaterThan(10);
    expect(operation.inputSchema.type).toBe("object");
    expect(operation.inputSchema.additionalProperties).toBe(false);
  });

  it.each(entries)("%s takes the workspace from the caller, never from input", (_, operation) => {
    expect(operation.path).toContain("{slug}");
    expect(Object.keys(operation.inputSchema.properties ?? {})).not.toContain("slug");
  });

  it("never exposes credentials, access management or the assistant's internal protocol", () => {
    const exposed = entries
      .filter(([, operation]) => operation.tool === "write" || !operation.path.includes("/access/"))
      .map(([name, operation]) => `${name} ${operation.path}`);
    expect(exposed.filter((entry) => /credential|internal|\/turns\/|plane-tools|\/access\//.test(entry))).toEqual([]);
  });

  it("never marks a GET as a write or a change as a read", () => {
    for (const [, operation] of entries) {
      if (operation.method === "GET") expect(operation.tool).toBe("read");
      if (["PUT", "PATCH", "DELETE"].includes(operation.method)) expect(operation.tool).toBe("write");
    }
  });
});
