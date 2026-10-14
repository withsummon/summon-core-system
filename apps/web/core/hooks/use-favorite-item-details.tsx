/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { IFavorite } from "@plane/types";
// components
import { getPageName } from "@plane/utils";
import {
  FavoriteItemIcon,
  generateFavoriteItemLink,
} from "@/components/workspace/sidebar/favorites/favorite-items/common";
// helpers
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useProjectView } from "@/hooks/store/use-project-view";
// plane web hooks
import { EPageStoreType, usePage } from "@/hooks/store";
import { useAdditionalFavoriteItemDetails } from "@/hooks/use-additional-favorite-item-details";

type TFavoriteEntityDetails = { name?: string; logo_props?: IFavorite["entity_data"]["logo_props"] } | null | undefined;

type TFavoriteItemDetailsSources = {
  favoriteItemName: string;
  favoriteItemLogoProps: IFavorite["entity_data"]["logo_props"];
  projectDetails: TFavoriteEntityDetails;
  pageDetails: TFavoriteEntityDetails;
  viewDetails: TFavoriteEntityDetails;
  cycleDetails: TFavoriteEntityDetails;
  moduleDetails: TFavoriteEntityDetails;
  getAdditionalDetails: () => ReturnType<
    ReturnType<typeof useAdditionalFavoriteItemDetails>["getAdditionalFavoriteItemDetails"]
  >;
};

const getFavoriteItemTitleAndIcon = (entityType: IFavorite["entity_type"], sources: TFavoriteItemDetailsSources) => {
  const { favoriteItemName, favoriteItemLogoProps } = sources;
  switch (entityType) {
    case "project":
      return {
        itemTitle: sources.projectDetails?.name ?? favoriteItemName,
        itemIcon: (
          <FavoriteItemIcon type="project" logo={sources.projectDetails?.logo_props || favoriteItemLogoProps} />
        ),
      };
    case "page":
      return {
        itemTitle: getPageName(sources.pageDetails?.name ?? favoriteItemName),
        itemIcon: <FavoriteItemIcon type="page" logo={sources.pageDetails?.logo_props ?? favoriteItemLogoProps} />,
      };
    case "view":
      return {
        itemTitle: sources.viewDetails?.name ?? favoriteItemName,
        itemIcon: <FavoriteItemIcon type="view" logo={sources.viewDetails?.logo_props || favoriteItemLogoProps} />,
      };
    case "cycle":
      return { itemTitle: sources.cycleDetails?.name ?? favoriteItemName, itemIcon: <FavoriteItemIcon type="cycle" /> };
    case "module":
      return {
        itemTitle: sources.moduleDetails?.name ?? favoriteItemName,
        itemIcon: <FavoriteItemIcon type="module" />,
      };
    default:
      return sources.getAdditionalDetails();
  }
};

export const useFavoriteItemDetails = (workspaceSlug: string, favorite: IFavorite) => {
  const {
    entity_identifier: favoriteItemId,
    entity_data: { logo_props: favoriteItemLogoProps },
    entity_type: favoriteItemEntityType,
  } = favorite;
  const favoriteItemName = favorite?.entity_data?.name || favorite?.name;
  const entityId = favoriteItemId ?? "";
  // store hooks
  const { getViewById } = useProjectView();
  const { getProjectById } = useProject();
  const { getCycleById } = useCycle();
  const { getModuleById } = useModule();
  // additional details
  const { getAdditionalFavoriteItemDetails } = useAdditionalFavoriteItemDetails();
  // derived values
  const pageDetail = usePage({
    pageId: entityId,
    storeType: EPageStoreType.PROJECT,
  });

  const itemLink = generateFavoriteItemLink(workspaceSlug.toString(), favorite);
  const { itemIcon, itemTitle } = getFavoriteItemTitleAndIcon(favoriteItemEntityType, {
    favoriteItemName,
    favoriteItemLogoProps,
    projectDetails: getProjectById(favorite.project_id ?? ""),
    pageDetails: pageDetail,
    viewDetails: getViewById(entityId),
    cycleDetails: getCycleById(entityId),
    moduleDetails: getModuleById(entityId),
    getAdditionalDetails: () => getAdditionalFavoriteItemDetails(workspaceSlug, favorite),
  });

  return { itemIcon, itemTitle, itemLink };
};
