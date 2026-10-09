import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CustomSelect } from "@plane/ui";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { SettingsBoxedControlItem } from "../settings/boxed-control-item";

export function ExportForm({
  workspaceId,
  settings,
}: {
  workspaceId: Id<"workspaces">;
  settings: FunctionReturnType<typeof api.exports.index.settings>;
}) {
  const { t } = useTranslation();
  const start = useMutation(api.exports.index.start);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filteredProjects = settings.projects.filter((project) =>
    `${project.name} ${project.identifier}`.toLowerCase().includes(search.toLowerCase())
  );
  const { control, handleSubmit, setValue } = useForm<FunctionArgs<typeof api.exports.index.start>>({
    defaultValues: { workspaceId, requestId: crypto.randomUUID(), format: settings.formats[0].value, projectIds: [] },
  });
  useReloadConfirmations(pending, "The export request is still being saved.", undefined, pending);
  const submit = handleSubmit(async (args) => {
    if (pending || !settings.canExport) return;
    setPending(true);
    setError("");
    try {
      await start(args);
      setValue("requestId", crypto.randomUUID());
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Export queued",
        message: "Your file will appear in Previous exports when it is ready.",
      });
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  });
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="rounded-lg border border-subtle bg-layer-2">
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title={t("workspace_settings.settings.exports.exporting_projects")}
          control={
            <Controller
              control={control}
              name="projectIds"
              render={({ field }) => (
                <Combobox.Root<Id<"projects">, Id<"projects">, true>
                  value={field.value}
                  onValueChange={(ids) => {
                    field.onChange(ids);
                    setValue("requestId", crypto.randomUUID());
                  }}
                  multiple
                  disabled={pending || !settings.canExport}
                  filter={null}
                  inputValue={search}
                  onInputValueChange={setSearch}
                  onOpenChange={(open) => {
                    if (!open) setSearch("");
                  }}
                >
                  <Combobox.Trigger
                    aria-label="Exporting projects"
                    className="flex w-full items-center justify-between gap-1 rounded border border-strong px-3 py-2 text-13 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {field.value.length ? `${field.value.length} project(s)` : "All projects"}
                    <ChevronDownIcon className="size-3" />
                  </Combobox.Trigger>
                  <Combobox.Clear
                    type="button"
                    tabIndex={0}
                    className="mt-2 w-full rounded px-1 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
                  >
                    All projects
                  </Combobox.Clear>
                  <Combobox.Portal>
                    <Combobox.Positioner side="bottom" align="end" sideOffset={4} className="z-[120]">
                      <Combobox.Popup className="max-w-48 min-w-48 rounded-md border border-subtle-1 bg-surface-1 p-2 text-11 shadow-raised-200 outline-none sm:max-w-[532px]">
                        <div className="flex items-center gap-1.5 rounded border border-subtle px-2">
                          <SearchIcon className="size-3.5 text-placeholder" />
                          <Combobox.Input
                            aria-label="Search export projects"
                            placeholder="Search"
                            className="w-full bg-transparent py-1 text-11 outline-none"
                          />
                        </div>
                        <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {filteredProjects.map((project) => (
                            <Combobox.Item
                              key={project.id}
                              value={project.id}
                              className="flex w-full cursor-default items-center justify-between gap-2 rounded px-1 py-1.5 outline-none data-[highlighted]:bg-layer-transparent-hover"
                            >
                              <span className="flex min-w-0 flex-1 gap-2">
                                <span className="shrink-0 text-10 text-secondary">{project.identifier}</span>
                                <span className="truncate">{project.name}</span>
                              </span>
                              <Combobox.ItemIndicator>
                                <CheckIcon className="size-3.5" />
                              </Combobox.ItemIndicator>
                            </Combobox.Item>
                          ))}
                          {filteredProjects.length === 0 && (
                            <p className="px-1.5 py-1 text-placeholder">No matches found</p>
                          )}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>
              )}
            />
          }
        />
        <SettingsBoxedControlItem
          className="rounded-none border-0 border-b"
          title={t("workspace_settings.settings.exports.format")}
          control={
            <Controller
              control={control}
              name="format"
              render={({ field }) => (
                <CustomSelect
                  ariaLabel="Export format"
                  value={field.value}
                  onChange={(format) => {
                    if (format !== field.value) setValue("requestId", crypto.randomUUID());
                    field.onChange(format);
                  }}
                  disabled={pending || !settings.canExport}
                  label={settings.formats.find(({ value }) => value === field.value)?.label}
                  optionsClassName="max-w-48 sm:max-w-[532px]"
                  placement="bottom-end"
                  buttonClassName="py-2 text-13"
                >
                  {settings.formats.map(({ value, label }) => (
                    <CustomSelect.Option key={value} value={value}>
                      {label}
                    </CustomSelect.Option>
                  ))}
                </CustomSelect>
              )}
            />
          }
        />
        <div className="px-4 py-3">
          <Button
            variant="primary"
            size="lg"
            type="submit"
            disabled={!settings.canExport || settings.projects.length === 0}
            loading={pending}
          >
            {pending ? `${t("workspace_settings.settings.exports.exporting")}...` : t("export")}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-13 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
