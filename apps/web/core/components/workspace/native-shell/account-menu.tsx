import { useQuery } from "convex/react";
import { useState } from "react";
import type { TProfileSettingsTabs } from "@plane/types";
import { ProfileSettingsModal } from "@/components/settings/profile/modal";
import { api } from "@summon/convex/api";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Avatar } from "@plane/ui";
import { UserMenuView } from "../sidebar/user-menu-view";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import type { NativeProfile } from "./types";
export function NativeAccountMenu({
  profile,
  onSignOut,
  beforeLeave,
}: {
  profile: NativeProfile;
  onSignOut: () => void;
  beforeLeave?: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<TProfileSettingsTabs | null>(null);
  const appearance = useQuery(api.identity.avatar.get, {});
  const avatar = (size: 20 | 40) =>
    appearance?.avatar ? (
      <AuthenticatedAssetImage
        asset={appearance.avatar}
        alt="Profile photo"
        className={size === 20 ? "size-5 rounded-full object-cover" : "size-10 rounded-full object-cover"}
      />
    ) : (
      <Avatar name={profile.displayName} size={size} shape="circle" />
    );
  const navigate = async (tab: "general" | "preferences") => {
    try {
      await beforeLeave?.();
      setActiveTab(tab);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Unable to leave Stickies",
        message: error instanceof Error ? error.message : "Save your changes before leaving.",
      });
    }
  };
  return (
    <>
      {activeTab && (
        <ProfileSettingsModal
          isOpen
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => setActiveTab(null)}
        />
      )}
      <UserMenuView
        displayName={profile.displayName}
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email}
        smallAvatar={avatar(20)}
        largeAvatar={avatar(40)}
        onSettings={() => void navigate("general")}
        onPreferences={() => void navigate("preferences")}
        onSignOut={onSignOut}
      />
    </>
  );
}
