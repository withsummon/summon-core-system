/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// types
import { Button } from "@plane/propel/button";
import type { IProject } from "@plane/types";
// ui
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

// type
type TJoinProjectModalProps = {
  isOpen: boolean;
  workspaceSlug: string;
  project: IProject;
  handleClose: () => void;
};

export function JoinProjectModal(props: TJoinProjectModalProps) {
  const { handleClose, isOpen, project, workspaceSlug } = props;
  // states
  const [isJoiningLoading, setIsJoiningLoading] = useState(false);
  // store hooks
  const { joinProject } = useUserPermissions();
  // router
  const router = useAppRouter();

  const handleJoin = async () => {
    setIsJoiningLoading(true);

    await joinProject(workspaceSlug, project.id)
      .then(() => {
        router.push(`/${workspaceSlug}/projects/${project.id}/issues`);
        handleClose();
        return;
      })
      .catch(() => {
        console.error("Error joining project");
      })
      .finally(() => {
        setIsJoiningLoading(false);
      });
  };

  return (
    <JoinProjectDialog
      isOpen={isOpen}
      name={project.name}
      handleClose={handleClose}
      onJoin={handleJoin}
      loading={isJoiningLoading}
    />
  );
}

export function JoinProjectDialog({
  isOpen,
  name,
  handleClose,
  onJoin,
  loading,
  error,
  canJoin = true,
}: {
  isOpen: boolean;
  name: string;
  handleClose: () => void;
  onJoin: () => void;
  loading: boolean;
  error?: string;
  canJoin?: boolean;
}) {
  const close = () => {
    if (!loading) handleClose();
  };
  return (
    <ModalCore isOpen={isOpen} handleClose={close} position={EModalPosition.CENTER} width={EModalWidth.XL}>
      <div className="space-y-5 px-5 py-8 sm:p-6">
        <h3 className="text-16 leading-6 font-medium text-primary">Join Project?</h3>
        <p>
          Are you sure you want to join the project <span className="font-semibold break-words">{name}</span>? Please
          click the &apos;Join Project&apos; button below to continue.
        </p>
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-danger-primary">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 px-5 pb-8 sm:px-6 sm:pb-6">
        <Button variant="secondary" size="lg" onClick={close} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          type="submit"
          onClick={onJoin}
          loading={loading}
          disabled={loading || !canJoin}
        >
          {loading ? "Joining..." : "Join Project"}
        </Button>
      </div>
    </ModalCore>
  );
}
