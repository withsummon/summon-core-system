import { useOutletContext } from "react-router";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core/page-title";
import { ExportGuide } from "@/components/exporter/guide";
import { SettingsHeading } from "@/components/settings/heading";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceSettingsShell } from "@/components/workspace/native-shell/workspace-shell";
import { ExportsWorkspaceSettingsHeader } from "./header";

export default function ExportsPage() {
  const session = useOutletContext<WorkspaceSession>();
  const { t } = useTranslation();
  return (
    <PreservedWorkspaceSettingsShell
      {...session}
      activePath={`/${session.workspace.slug}/settings/exports/`}
      header={<ExportsWorkspaceSettingsHeader />}
      hugging
    >
      <PageHead title={`${session.workspace.name} - ${t("workspace_settings.settings.exports.title")}`} />
      <div className="flex w-full flex-col gap-y-6">
        <SettingsHeading
          title={t("workspace_settings.settings.exports.heading")}
          description={t("workspace_settings.settings.exports.description")}
        />
        <ExportGuide workspaceId={session.workspace._id} />
      </div>
    </PreservedWorkspaceSettingsShell>
  );
}
