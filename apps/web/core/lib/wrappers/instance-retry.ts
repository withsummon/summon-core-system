/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const FIRST_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10_000;

/**
 * How long to wait before retry number `retryCount` (1-based) of the instance request: 1 s, doubling up to 10 s,
 * so a restarting API is picked up within seconds and a longer outage is polled gently.
 */
export function getInstanceRetryDelay(retryCount: number): number {
  return Math.min(FIRST_RETRY_DELAY_MS * 2 ** Math.max(retryCount - 1, 0), MAX_RETRY_DELAY_MS);
}
