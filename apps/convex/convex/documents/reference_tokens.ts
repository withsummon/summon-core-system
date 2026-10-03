export type DocumentReferenceToken = { transactionId: string; entityName: string; entityIdentifier: string };
function referenceToken(node: object): DocumentReferenceToken | null {
  if (!("type" in node) || (node.type !== "mention" && node.type !== "imageComponent")) return null;
  const attrs = "attrs" in node ? node.attrs : null;
  if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) return null;
  const transactionId = "id" in attrs ? attrs.id : null;
  const entityName = node.type === "imageComponent" ? "image" : "entity_name" in attrs ? attrs.entity_name : null;
  const entityIdentifier =
    node.type === "imageComponent"
      ? "src" in attrs
        ? attrs.src
        : null
      : "entity_identifier" in attrs
        ? attrs.entity_identifier
        : null;
  if (
    typeof transactionId !== "string" ||
    !transactionId ||
    typeof entityName !== "string" ||
    typeof entityIdentifier !== "string"
  )
    return null;
  return { transactionId, entityName, entityIdentifier };
}
/** Read canonical editor JSON without changing tokens or their transaction identity. */
export function documentReferenceTokens(value: unknown): DocumentReferenceToken[] {
  const tokens = new Map<string, DocumentReferenceToken>();
  const pending: unknown[] = [value];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object" || Array.isArray(node)) continue;
    const token = referenceToken(node);
    if (token) tokens.set(token.transactionId, token);
    if ("content" in node && Array.isArray(node.content)) pending.push(...node.content);
  }
  return [...tokens.values()];
}
