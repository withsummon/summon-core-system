import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { MenuPrimitive as Menu } from "@plane/propel/menu";
import { CheckIcon, ChevronDownIcon } from "@plane/propel/icons";
import { CirclePlus, LogOut, Mails, Settings, UserPlus } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import type { NativeWorkspace, NativeProfile } from "./session";
function Logo({ workspace }: { workspace: NativeWorkspace }) {
  return (
    <div className="relative grid size-7 shrink-0 place-items-center rounded-md border border-subtle bg-accent-primary text-on-color uppercase">
      {workspace.logo ? (
        <AuthenticatedAssetImage
          asset={workspace.logo}
          alt="Workspace logo"
          className="absolute inset-0 size-full rounded-md object-cover"
        />
      ) : (
        workspace.name[0]
      )}
    </div>
  );
}
function MemberCount({ workspace }: { workspace: NativeWorkspace }) {
  const { t } = useTranslation();
  const { results, status, loadMore } = usePaginatedQuery(
    api.workspaces.member_count.page,
    { workspaceId: workspace._id },
    { initialNumItems: 50 }
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(50);
  }, [status, loadMore]);
  return (
    <span className="capitalize">
      {status === "Exhausted"
        ? t("member", { count: results.reduce((total, row) => total + row.activeMembers, 0) })
        : t("loading")}
    </span>
  );
}
export function NativeWorkspaceMenu({
  workspace,
  workspaces,
  user,
  onSignOut,
  beforeLeave,
}: {
  workspace: NativeWorkspace;
  workspaces: NativeWorkspace[];
  user: NativeProfile;
  onSignOut: () => void;
  beforeLeave?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const select = useMutation(api.identity.preferences.selectWorkspace);
  const availability = useQuery(api.identity.instance.configuration.availability, {});
  // Sorting a newly filtered array does not mutate canonical query data.
  const ordered = [
    workspace,
    // oxlint-disable-next-line unicorn/no-array-sort
    ...workspaces.filter((item) => item._id !== workspace._id).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <div className="relative flex h-full w-full max-w-48 min-w-0 flex-grow lg:w-fit">
        <Menu.Trigger
          className={cn(
            "group/menu-button flex flex-grow items-center justify-between gap-1 truncate rounded-sm p-1 text-13 font-medium text-secondary hover:bg-layer-1 focus:outline-none",
            { "bg-layer-1": open }
          )}
          aria-label={t("aria_labels.projects_sidebar.open_workspace_switcher")}
        >
          <div className="flex flex-grow items-center gap-2 truncate">
            <Logo workspace={workspace} />
            <h4 className="truncate text-14 font-medium text-primary">{workspace.name}</h4>
          </div>
          <ChevronDownIcon
            className={cn("size-4 flex-shrink-0 text-placeholder duration-300", { "rotate-180": open })}
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={4} className="z-[120]">
            <Menu.Popup className="flex w-[19rem] max-w-[calc(100vw-2rem)] flex-col divide-y divide-subtle rounded-md border border-strong bg-surface-1 shadow-raised-200 outline-none">
              <div className="vertical-scrollbar flex scrollbar-sm max-h-96 flex-col items-start justify-start overflow-x-hidden overflow-y-scroll">
                <span className="sticky top-0 z-21 h-full w-full flex-shrink-0 truncate rounded-md bg-surface-1 px-4 pt-3 pb-1 text-left text-13 font-medium text-placeholder">
                  {user.email}
                </span>
                <div className="flex size-full flex-col items-start justify-start">
                  {ordered.map((item) => (
                    <div className="w-full" key={item._id}>
                      <Menu.Item
                        render={<Link href={`/${item.slug}/stickies/`} />}
                        onClick={async (event) => {
                          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
                            return;
                          event.preventDefault();
                          try {
                            await beforeLeave?.();
                            const destination = await select({ workspaceId: item._id });
                            router.push(`/${destination.slug}/stickies/`);
                          } catch (error) {
                            setToast({
                              type: TOAST_TYPE.ERROR,
                              title: "Unable to switch workspace",
                              message: error instanceof Error ? error.message : "Try again.",
                            });
                          }
                        }}
                        className={cn("block px-4 py-2 outline-none data-[highlighted]:bg-layer-transparent-hover", {
                          "bg-layer-transparent-active": item._id === workspace._id,
                        })}
                      >
                        <div className="flex items-center justify-between gap-1 rounded-sm p-1 text-13 text-primary">
                          <div className="relative flex w-[80%] items-center justify-start gap-2.5">
                            <Logo workspace={item} />
                            <div className="w-[inherit]">
                              <div className="truncate text-left text-13 font-medium text-ellipsis">{item.name}</div>
                              <div className="flex w-fit gap-2 text-13 text-tertiary capitalize">
                                <span>{item.membershipRole}</span>
                                <div className="m-auto h-1 w-1 rounded-full bg-layer-1/50" />
                                {open && <MemberCount workspace={item} />}
                              </div>
                            </div>
                          </div>
                          {item._id === workspace._id && (
                            <span className="flex-shrink-0 p-1">
                              <CheckIcon className="h-5 w-5 text-primary" />
                            </span>
                          )}
                        </div>
                      </Menu.Item>
                      {item._id === workspace._id && (
                        <div className="mt-2 mb-1 flex gap-2">
                          {item.membershipRole !== "guest" && (
                            <Menu.Item
                              render={<Link href={`/${item.slug}/settings`} />}
                              className="flex gap-1.5 rounded-md border border-strong bg-layer-2 px-2.5 py-1.5 text-secondary"
                            >
                              <Settings className="size-4" />
                              {t("settings")}
                            </Menu.Item>
                          )}
                          {item.membershipRole === "admin" && (
                            <Menu.Item
                              render={<Link href={`/${item.slug}/settings/members`} />}
                              className="flex gap-1.5 rounded-md border border-strong bg-layer-2 px-2.5 py-1.5 text-secondary"
                            >
                              <UserPlus className="size-4" />
                              {t("project_settings.members.invite_members.title")}
                            </Menu.Item>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex w-full flex-col items-start justify-start gap-2 px-4 py-2 text-13">
                {availability && !availability.isWorkspaceCreationDisabled && (
                  <Menu.Item render={<Link href="/create-workspace" />} className="flex items-center gap-2 px-2 py-1">
                    <CirclePlus className="size-4" />
                    {t("create_workspace")}
                  </Menu.Item>
                )}
                <Menu.Item render={<Link href="/invitations" />} className="flex items-center gap-2 px-2 py-1">
                  <Mails className="size-4" />
                  {t("workspace_invites")}
                </Menu.Item>
                <Menu.Item
                  nativeButton
                  render={<button type="button" />}
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 px-2 py-1 text-danger-primary"
                >
                  <LogOut className="size-4" />
                  {t("sign_out")}
                </Menu.Item>
              </div>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </div>
    </Menu.Root>
  );
}
