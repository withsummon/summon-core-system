import { ConnectedAccounts } from "./accounts/accounts";
import { AccountPassword } from "./password/password";
import { AccountSessions } from "./sessions/sessions";
import { PreferencesForm } from "./preferences";
import { ProfileAppearance } from "./appearance";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";

type ProfileData = FunctionReturnType<typeof api.identity.profile.get>;
export function Profile() {
  const profile = useQuery(api.identity.profile.get);
  const [editing, setEditing] = useState(false);
  const [preferencesEditing, setPreferencesEditing] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  return (
    <details className="mt-6 border-t border-subtle-1 pt-4 text-14">
      <summary className="cursor-pointer">Account details</summary>
      {profile ? (
        <div className="mt-3 space-y-3">
          <ProfileAppearance theme={profile.preferences.theme} />
          <p className="font-medium break-words">{profile.displayName || "Your profile"}</p>
          <p className="break-all text-secondary">{profile.email}</p>
          <Button variant="secondary" aria-expanded={sessionsOpen} onClick={() => setSessionsOpen(!sessionsOpen)}>
            {sessionsOpen ? "Hide sessions" : "Manage sessions"}
          </Button>
          {sessionsOpen && <AccountSessions />}
          <Button
            type="button"
            variant="secondary"
            aria-expanded={passwordOpen}
            onClick={() => setPasswordOpen(!passwordOpen)}
          >
            {passwordOpen ? "Hide password settings" : "Manage password"}
          </Button>
          {passwordOpen && <AccountPassword />}
          <Button
            type="button"
            variant="secondary"
            aria-expanded={accountsOpen}
            onClick={() => setAccountsOpen(!accountsOpen)}
          >
            {accountsOpen ? "Hide connected accounts" : "Connected accounts"}
          </Button>
          {accountsOpen && <ConnectedAccounts />}
          <p className="text-12 text-secondary">Your user ID</p>
          <code className="block text-12 break-all select-all">{profile.id}</code>
          {preferencesEditing ? (
            <PreferencesForm
              key={`preferences:${profile.id}`}
              initial={profile}
              onClose={() => setPreferencesEditing(false)}
            />
          ) : (
            <Button variant="secondary" onClick={() => setPreferencesEditing(true)}>
              Edit preferences
            </Button>
          )}
          {editing ? (
            <ProfileForm key={`profile:${profile.id}`} initial={profile} onClose={() => setEditing(false)} />
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )}
        </div>
      ) : (
        <p role="status">Loading profile…</p>
      )}
    </details>
  );
}
function ProfileForm({ initial, onClose }: { initial: ProfileData; onClose: () => void }) {
  const [snapshot] = useState(initial);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.identity.profile.save);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ displayName, firstName, lastName, timezone, expectedRevision: snapshot.revision });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Display name">
        <Input
          required
          maxLength={255}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full"
        />
      </SummonField>
      <SummonField label="First name">
        <Input maxLength={255} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full" />
      </SummonField>
      <SummonField label="Last name">
        <Input maxLength={255} value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full" />
      </SummonField>
      <SummonField label="Profile timezone">
        <Input
          required
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="Asia/Jakarta"
          className="w-full"
        />
      </SummonField>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
