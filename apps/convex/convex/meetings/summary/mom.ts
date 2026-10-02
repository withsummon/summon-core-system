import type { z } from "zod/v4";
import { resultSchema } from "./schema";
export type MeetingSummary = z.infer<typeof resultSchema>;
export function parseMom(text: string): MeetingSummary {
  if (text.length > 60000) throw new Error("Summary is too large");
  return resultSchema.parse(JSON.parse(text));
}
const cell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const time = (value: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
export function renderMom(
  metadata: {
    title: string;
    project: string;
    startsAt: number;
    endsAt: number | null;
    location: string;
    participants: string[];
    client: string;
  },
  result: MeetingSummary
) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(metadata.startsAt);
  const lines = [
    "# MINUTES OF MEETING",
    "",
    "**PT Summon Cipta Inovasi**",
    "",
    "| Metadata | Detail |",
    "|---|---|",
    `| Project | ${cell(metadata.project)} |`,
    `| Client | ${cell(metadata.client) || "Tidak tercantum"} |`,
    "| Nomor Dokumen | Tidak tercantum |",
    `| Topik | ${cell(metadata.title)} |`,
    `| Tanggal | ${date} |`,
    `| Waktu | ${time(metadata.startsAt)}${metadata.endsAt === null ? "" : `–${time(metadata.endsAt)}`} WIB |`,
    `| Tempat | ${cell(metadata.location) || "Tidak tercantum"} |`,
    `| Peserta | ${cell(metadata.participants.join(", ")) || "Tidak tercantum"} |`,
  ];
  for (const group of result.todos_by_party) {
    lines.push("", `## TO-DO LIST — ${group.party}`, "", "| No | Tugas | Keterangan |", "|---:|---|---|");
    lines.push(
      ...group.items.map(
        (item, index) => `| ${index + 1} | ${cell(item.task)} | ${cell(item.notes) || "Tidak tercantum"} |`
      )
    );
    if (!group.items.length) lines.push("| 1 | Tidak ada tindak lanjut yang tercatat | — |");
  }
  if (!result.todos_by_party.length)
    lines.push(
      "",
      "## TO-DO LIST",
      "",
      "| No | Tugas | Keterangan |",
      "|---:|---|---|",
      "| 1 | Tidak ada tindak lanjut yang tercatat | — |"
    );
  lines.push("", "## RINGKASAN PEMBAHASAN");
  if (result.discussion_topics.length)
    for (const topic of result.discussion_topics)
      lines.push(
        "",
        `### ${topic.topic}`,
        ...(topic.details.length ? topic.details.map((d) => `- ${d}`) : ["- Tidak ada detail yang tercatat."])
      );
  else lines.push("", result.summary);
  lines.push(
    "",
    "## KEPUTUSAN",
    ...(result.decisions.length ? result.decisions.map((d) => `- ${d}`) : ["- Tidak ada keputusan yang tercatat."])
  );
  lines.push(
    "",
    "## OPEN ITEMS",
    ...(result.open_items.length ? result.open_items.map((d) => `- ${d}`) : ["- Tidak ada open item yang tercatat."])
  );
  lines.push("", "## NEXT ACTIONS", "", "| No | Tindakan | PIC | Tenggat |", "|---:|---|---|---|");
  lines.push(
    ...result.next_actions.map(
      (item, index) =>
        `| ${index + 1} | ${cell(item.action)} | ${cell(item.owner) || "Tidak tercantum"} | ${cell(item.due_date) || "Tidak tercantum"} |`
    )
  );
  if (!result.next_actions.length) lines.push("| 1 | Tidak ada next action yang tercatat | — | — |");
  return lines.join("\n");
}
