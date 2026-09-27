import { convertHTMLToMarkdown } from "@plane/utils";
import { preparePdfHTML } from "@/components/editor/pdf/prepare-content";

export async function exportContent({
  html,
  title,
  noImages,
  format,
  resolveImage,
}: {
  html: string;
  title: string;
  noImages: boolean;
  format: "pdf" | "markdown";
  resolveImage: (source: string) => Promise<string>;
}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  // Native document mentions do not yet have a directory owner. Preserve their
  // presence explicitly instead of fabricating names or silently dropping them.
  parsed.querySelectorAll("mention-component").forEach((node) => {
    node.replaceWith(parsed.createTextNode("@Unavailable mention"));
  });
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
