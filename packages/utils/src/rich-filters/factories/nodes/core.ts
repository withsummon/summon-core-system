/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { v4 as uuidv4 } from "uuid";
// plane imports
import type {
  TFilterGroupNode,
  TFilterConditionNode,
  TFilterConditionPayload,
  TFilterExpression,
  TFilterProperty,
  TFilterValue,
  TLogicalOperator,
} from "@plane/types";
import { FILTER_NODE_TYPE } from "@plane/types";

/**
 * Creates a condition node with a unique ID.
 * @param condition - The condition to create
 * @returns The created condition node
 */
export const createConditionNode = <P extends TFilterProperty, V extends TFilterValue>(
  condition: TFilterConditionPayload<P, V>
): TFilterConditionNode<P, V> => ({
  id: uuidv4(),
  type: FILTER_NODE_TYPE.CONDITION,
  ...condition,
});

/**
 * Creates a logical group node with a unique ID.
 * @param nodes - The nodes to add to the group
 * @returns The created group node
 */
export const createGroupNode = <P extends TFilterProperty>(
  logicalOperator: TLogicalOperator,
  nodes: TFilterExpression<P>[]
): TFilterGroupNode<P> => ({
  id: uuidv4(),
  type: FILTER_NODE_TYPE.GROUP,
  logicalOperator,
  children: nodes,
});
