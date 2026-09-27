export function meetingDocumentTitle(title: string, kind: "transcript" | "MoM") {
  return `${title.slice(0, 255 - kind.length - 1)} ${kind}`;
}
