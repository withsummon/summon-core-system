/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// Repeated blocks are allowed, so key each one by its text and occurrence count
const withContentKeys = (texts: string[]) => {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const occurrence = (seen.get(text) ?? 0) + 1;
    seen.set(text, occurrence);
    return { text, key: `${occurrence}:${text}` };
  });
};

function KnowledgeParagraph({ paragraph }: { paragraph: string }) {
  if (paragraph.startsWith("# ")) {
    return (
      <h1 className="border-b border-subtle pb-2 text-2xl font-bold text-primary">{paragraph.replace("# ", "")}</h1>
    );
  }
  if (paragraph.startsWith("## ")) {
    return <h2 className="mt-4 text-lg font-semibold text-primary">{paragraph.replace("## ", "")}</h2>;
  }
  if (paragraph.startsWith("### ")) {
    return <h3 className="mt-3 text-sm font-semibold text-primary">{paragraph.replace("### ", "")}</h3>;
  }
  if (paragraph.startsWith("- ")) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-secondary">
        {withContentKeys(paragraph.split("\n")).map(({ text, key }) => (
          <li key={key}>{text.replace(/^-\s*/, "")}</li>
        ))}
      </ul>
    );
  }
  if (paragraph.startsWith("1. ")) {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-secondary">
        {withContentKeys(paragraph.split("\n")).map(({ text, key }) => (
          <li key={key}>{text.replace(/^\d+\.\s*/, "")}</li>
        ))}
      </ol>
    );
  }
  return <p className="leading-relaxed text-secondary">{paragraph}</p>;
}

export function KnowledgeContent({ content }: { content: string }) {
  return (
    <div className="space-y-4">
      {withContentKeys(content.split("\n\n")).map(({ text, key }) => (
        <KnowledgeParagraph key={key} paragraph={text} />
      ))}
    </div>
  );
}
