"use node";
import {
  getBinaryDataFromDocumentEditorHTMLString,
  getAllDocumentFormatsFromDocumentEditorBinaryData,
  replaceDocumentEditorHTML,
} from "@plane/editor/lib";
// Both fragments and all derived formats belong to the canonical editor owner.
export function convertGeneratedText(text: string, title: string, existing: ArrayBuffer | null = null) {
  const html = "<pre>" + text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "</pre>";
  const binary =
    existing === null
      ? getBinaryDataFromDocumentEditorHTMLString(html, title)
      : replaceDocumentEditorHTML(new Uint8Array(existing), html, title);
  const formats = getAllDocumentFormatsFromDocumentEditorBinaryData(binary);
  return {
    descriptionBinary: new Uint8Array(binary).buffer,
    descriptionHtml: formats.contentHTML,
    descriptionJson: formats.contentJSON,
  };
}
