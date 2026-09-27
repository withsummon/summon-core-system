import { convertHTMLToMarkdown } from "@plane/utils";
import { preparePdfHTML } from "@/components/editor/pdf/prepare-content";

export async function exportContent({
  html,
  title,
  noImages,
  format,
  resolveImage,
  resolveMentions,
}: {
  html: string;
  title: string;
  noImages: boolean;
  format: "pdf" | "markdown";
  resolveImage: (source: string) => Promise<string>;
  resolveMentions: (ids: string[]) => Promise<Map<string, string>>;
}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const mentions = Array.from(parsed.querySelectorAll("mention-component"));
  const ids = [
    ...new Set(
      mentions
        .filter((node) => node.getAttribute("entity_name") === "user_mention")
        .map((node) => node.getAttribute("entity_identifier") ?? "")
    ),
  ];
  const labels = new Map<string, string>();
  for (let start = 0; start < ids.length; start += 100) {
    // Explicit bounded batches retain every stored mention without truncation.
    // oxlint-disable-next-line no-await-in-loop
    const batch = await resolveMentions(ids.slice(start, start + 100));
    for (const [id, label] of batch) labels.set(id, label);
  }
  for (const node of mentions) {
    const label =
      node.getAttribute("entity_name") === "user_mention"
        ? (labels.get(node.getAttribute("entity_identifier") ?? "") ?? "Unavailable member")
        : "Unsupported mention";
    node.replaceWith(parsed.createTextNode(`@${label}`));
  }
  if (
    !noImages &&
    Array.from(parsed.querySelectorAll("image-component, img")).some((image) => !image.getAttribute("src"))
  )
    throw new Error("Finish uploading images before exporting, or choose No images.");
  if (format === "pdf") {
    const heading = parsed.createElement("h1");
    heading.className = "page-title";
    heading.textContent = title;
    parsed.body.prepend(heading);
    return preparePdfHTML(
      { htmlContent: parsed.body.innerHTML, noAssets: noImages },
      { resolveMention: () => "Unavailable mention", resolveImage }
    );
  }
  parsed.querySelectorAll("issue-embed-component").forEach((node) => node.remove());
  const images = Array.from(parsed.querySelectorAll("image-component, img"));
  for (const image of images) {
    if (noImages) {
      image.remove();
      continue;
    }
    const source = image.getAttribute("src");
    if (!source) throw new Error("Finish uploading images before exporting, or choose No images.");
    // Sequential reads avoid fetching all document images at once.
    // oxlint-disable-next-line no-await-in-loop
    const url = await resolveImage(source);
    const replacement = parsed.createElement("img");
    replacement.setAttribute("src", url);
    replacement.setAttribute("alt", image.getAttribute("alt") || "Image");
    image.replaceWith(replacement);
  }
  return convertHTMLToMarkdown({
    description_html: parsed.body.innerHTML,
    metaData: { file_assets: [], user_mentions: [] },
  });
}
