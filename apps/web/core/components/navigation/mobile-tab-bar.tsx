/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { DotsThreeCircleIcon } from "@phosphor-icons/react";
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Drawer, DrawerContent, DrawerTitle } from "@plane/propel/drawer";
import { SelectableIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
import { SummonThemeToggle } from "@/components/summon/theme-toggle";
import { getSidebarNavigationItemIcon } from "@/components/workspace/sidebar/helper";
import { useUserPermissions } from "@/hooks/store/user";
import type { TMobileNavGroup, TMobileNavLink } from "./mobile-tab-bar-items";
import { getMobileNavigation } from "./mobile-tab-bar-items";

/**
 * The phone's primary navigation: a floating tab bar that replaces the sidebar below md. The four core
 * destinations sit one tap away and More opens a bottom sheet with the rest. A tinted pill slides to the open
 * tab and its icon fills, so the move reads as one motion.
 */
export const MobileTabBar = observer(function MobileTabBar() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const slug = workspaceSlug?.toString() ?? "";

  const { tabs, groups, isMoreActive } = getMobileNavigation(slug, pathname, (item) =>
    allowPermissions(item.access, EUserPermissionsLevel.WORKSPACE, slug)
  );
  const isMoreSelected = isMoreOpen || isMoreActive;
  const indicatorIndex = isMoreSelected ? tabs.length : tabs.findIndex((link) => link.isActive);

  return (
    <nav
      aria-label="Primary"
      className="relative z-[26] flex-none px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] md:hidden"
    >
      <TabRow indicatorIndex={indicatorIndex}>
        {tabs.map((link) => (
          <Link
            key={link.item.key}
            href={link.href}
            prefetch="intent"
            aria-current={link.isActive ? "page" : undefined}
            className={tabClassName}
          >
            {getSidebarNavigationItemIcon(link.item.key, "size-6")}
            <span className="truncate">{t(link.item.labelTranslationKey)}</span>
          </Link>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isMoreOpen}
          data-active={isMoreSelected || undefined}
          onClick={() => setIsMoreOpen(true)}
          className={tabClassName}
        >
          <SelectableIcon icon={DotsThreeCircleIcon} className="size-6" />
          <span>{t("summon.more")}</span>
        </button>
      </TabRow>
      <MoreSheet open={isMoreOpen} onOpenChange={setIsMoreOpen} groups={groups} />
    </nav>
  );
});

const tabClassName = cn(
  "group/select relative z-10 flex min-h-12 min-w-0 flex-1 press flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-11 font-medium text-tertiary outline-none",
  "transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-strong",
  "aria-[current=page]:text-accent-primary data-[active]:text-accent-primary"
);

/**
 * The bar's surface plus one indicator measured onto the selected tab. The first placement lands without
 * motion; later ones slide on the same curve as the sheet.
 */
function TabRow({ indicatorIndex, children }: { indicatorIndex: number; children: React.ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  // Measures the DOM, which only exists after layout: the indicator must sit on the tab before paint.
  useLayoutEffect(() => {
    const row = rowRef.current;
    const indicator = indicatorRef.current;
    if (!row || !indicator) return;
    const place = () => {
      const tab =
        indicatorIndex < 0 ? null : row.querySelectorAll<HTMLElement>(":scope > a, :scope > button")[indicatorIndex];
      indicator.hidden = !tab;
      if (!tab) return;
      indicator.style.setProperty("--tab-left", `${tab.offsetLeft}px`);
      indicator.style.setProperty("--tab-width", `${tab.offsetWidth}px`);
      requestAnimationFrame(() => indicator.setAttribute("data-placed", ""));
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(row);
    return () => resize.disconnect();
  }, [indicatorIndex]);

  return (
    <div
      ref={rowRef}
      className="relative mx-auto flex max-w-md items-stretch rounded-2xl border border-subtle bg-surface-1/90 p-1 shadow-raised-200 backdrop-blur-xl"
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute inset-y-1 left-(--tab-left) w-(--tab-width) rounded-xl bg-accent-subtle transition-[left,width] duration-300 ease-spring-sheet not-data-placed:transition-none motion-reduce:transition-none"
      />
      {children}
    </div>
  );
}

/** Every destination that doesn't earn a tab, grouped by job, plus the appearance switch the top bar drops on a phone. */
const MoreSheet = observer(function MoreSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: TMobileNavGroup[];
}) {
  const { t } = useTranslation();

  return (
    <Drawer side="bottom" open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent backdrop className="scrollbar-hide overflow-y-auto overscroll-contain">
        <DrawerTitle className="px-5 pt-6 pb-1 text-16 font-semibold text-primary">{t("summon.more")}</DrawerTitle>
        <div className="flex flex-col gap-4 px-3 pt-2 pb-4">
          {props.groups.map((group) => (
            <section key={group.key} aria-labelledby={`more-${group.key}`}>
              <h3 id={`more-${group.key}`} className="px-2 pb-1 text-12 font-medium text-tertiary">
                {t(`summon.nav_groups.${group.key}`)}
              </h3>
              <ul className="overflow-hidden rounded-xl border border-subtle bg-layer-1">
                {group.links.map((link) => (
                  <MoreLink key={link.item.key} link={link} onNavigate={() => props.onOpenChange(false)} />
                ))}
              </ul>
            </section>
          ))}
          <div className="flex min-h-12 items-center justify-between rounded-xl border border-subtle bg-layer-1 px-3">
            <span className="text-14 text-primary">{t("summon.appearance")}</span>
            <SummonThemeToggle />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
});

function MoreLink({ link, onNavigate }: { link: TMobileNavLink; onNavigate: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="border-b border-subtle last:border-b-0">
      <Link
        href={link.href}
        prefetch="intent"
        onClick={onNavigate}
        aria-current={link.isActive ? "page" : undefined}
        className="group/select flex min-h-12 items-center gap-3 px-3 text-14 text-primary outline-none hover:bg-layer-1-hover focus-visible:bg-layer-1-hover aria-[current=page]:font-medium aria-[current=page]:text-accent-primary"
      >
        {getSidebarNavigationItemIcon(
          link.item.key,
          "size-5 text-tertiary group-aria-[current=page]/select:text-accent-primary"
        )}
        <span className="min-w-0 flex-1 truncate">{t(link.item.labelTranslationKey)}</span>
      </Link>
    </li>
  );
}
