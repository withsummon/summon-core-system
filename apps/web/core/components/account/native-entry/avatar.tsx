import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import { UserImageUploadDialog } from "@/components/core/modals/user-image-upload-dialog";
import { AuthenticatedAssetImage } from "@/components/convex-core/assets/image";
import { uploadFileAsset } from "@/components/convex-core/assets/upload-file";

export function ProfileAvatarDialog({
  revision,
  onAcknowledged,
  onClose,
}: {
  revision: number;
  onAcknowledged: (startingRevision: number, committedRevision: number) => void;
  onClose: () => void;
}) {
  const [openingRevision, setOpeningRevision] = useState(revision);
  const transfer = useRef<AbortController | null>(null);
  useEffect(() => () => transfer.current?.abort(), []);
  const appearance = useQuery(api.identity.avatar.get);
  const policy = useQuery(api.assets.index.policy);
  const prepare = useMutation(api.identity.avatar.prepare);
  const finalize = useAction(api.identity.avatar_upload.finalize);
  const remove = useMutation(api.identity.avatar.remove);
  if (!appearance || !policy) return <p role="status">Loading profile photo…</p>;
  return (
    <UserImageUploadDialog
      isOpen
      onClose={onClose}
      currentImage={
        appearance.avatar ? (
          <AuthenticatedAssetImage
            key={appearance.avatar.id}
            asset={appearance.avatar}
            alt="Profile avatar"
            className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
          />
        ) : null
      }
      onUpload={async (file) => {
        const controller = new AbortController();
        transfer.current = controller;
        const receipt = await uploadFileAsset(
          file,
          policy,
          (metadata) => prepare({ slot: "avatar", ...metadata, expectedRevision: openingRevision }),
          finalize,
          controller.signal
        );
        onAcknowledged(receipt.startingRevision, receipt.profileRevision);
        onClose();
      }}
      onRemove={async () => {
        if (!appearance.avatar) return;
        const receipt = await remove({
          slot: "avatar",
          assetId: appearance.avatar.id,
          expectedRevision: openingRevision,
        });
        onAcknowledged(openingRevision, receipt.revision);
        setOpeningRevision(receipt.revision);
      }}
    />
  );
}
