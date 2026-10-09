import { createContext, useContext, useEffect, useCallback, useState } from "react";
import { useBlocker, useBeforeUnload } from "react-router";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import { observer } from "mobx-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { useTheme } from "@/hooks/store";
import { authClient } from "./instance.provider";

function useCurrentSession() {
  const authentication = useConvexAuth();
  const session = authClient.useSession();
  const authority = useQuery(api.identity.instance.index.me, authentication.isAuthenticated ? {} : "skip");
  return { authentication, session, authority };
}
const SessionContext = createContext<ReturnType<typeof useCurrentSession> | null>(null);
export function useAdminSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Administration session owner is missing.");
  return session;
}
export const UserProvider = observer(function UserProvider({ children }: React.PropsWithChildren) {
  const session = useCurrentSession();
  const { isSidebarCollapsed, toggleSidebar } = useTheme();
  useEffect(() => {
    if (isSidebarCollapsed === undefined) toggleSidebar(localStorage.getItem("god_mode_sidebar_collapsed") === "true");
  }, [isSidebarCollapsed, toggleSidebar]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
});

// One registered form owns each Administration route. The native router and
// browser unload boundary consume its real dirty/submitting state directly.
export function AdminFormNavigationGuard({ pending, dirty = false }: { pending: boolean; dirty?: boolean }) {
  const blocker = useBlocker(pending || dirty);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (pending || dirty) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [pending, dirty]
    )
  );
  return (
    <ConfirmDiscardModal
      isOpen={blocker.state === "blocked"}
      pending={pending}
      dirty={dirty}
      handleClose={() => {
        if (blocker.state === "blocked") blocker.reset();
      }}
      onDiscard={() => {
        if (!pending && blocker.state === "blocked") blocker.proceed();
      }}
    />
  );
}
// The captured subject is draft ownership, never permission. Only the current
// issued subject plus current singleton binding can enable the editor.
export function useAdminDraftOwner() {
  const { session, authority, authentication } = useAdminSession();
  const subject = session.data?.user.id;
  const allowed = authentication.isAuthenticated && authority?.isInstanceAdmin === true;
  const [owner, setOwner] = useState<string | null>(null);
  useEffect(() => {
    if (owner === null && allowed && subject) setOwner(subject);
  }, [owner, allowed, subject]);
  return {
    canEdit: allowed && owner !== null && owner === subject,
    changedSubject: owner !== null && subject !== undefined && owner !== subject,
    discard: () => {
      if (allowed && subject) setOwner(subject);
    },
  };
}
