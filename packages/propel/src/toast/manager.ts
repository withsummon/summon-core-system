/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { Toast as BaseToast } from "@base-ui/react/toast";

export enum TOAST_TYPE {
  SUCCESS = "success",
  ERROR = "error",
  INFO = "info",
  WARNING = "warning",
  LOADING = "loading",
  LOADING_TOAST = "loading-toast",
}

export type SetToastProps =
  | {
      type: TOAST_TYPE.LOADING;
      title?: string;
    }
  | {
      id?: string | number;
      type: Exclude<TOAST_TYPE, TOAST_TYPE.LOADING>;
      title: string;
      message?: string;
      actionItems?: React.ReactNode;
    };

type PromiseToastCallback<ToastData> = (data: ToastData) => string;
type ActionItemsPromiseToastCallback<ToastData> = (data: ToastData) => React.ReactNode;

type PromiseToastData<ToastData> = {
  title: string;
  message?: PromiseToastCallback<ToastData>;
  actionItems?: ActionItemsPromiseToastCallback<ToastData>;
};

type PromiseToastOptions<ToastData> = {
  loading?: string;
  success: PromiseToastData<ToastData>;
  error: PromiseToastData<ToastData>;
};

export const toastManager = BaseToast.createToastManager();

export const setToast = (props: SetToastProps) => {
  let toastId: string | undefined;
  if (props.type !== TOAST_TYPE.LOADING) {
    toastId = toastManager.add({
      data: {
        type: props.type,
        title: props.title,
        message: props.message,
        actionItems: props.actionItems,
      },
    });
  } else {
    toastId = toastManager.add({
      data: {
        type: props.type,
        title: props.title,
      },
    });
  }
  return toastId;
};

export const updateToast = (id: string, props: SetToastProps) => {
  toastManager.update(id, {
    data:
      props.type === TOAST_TYPE.LOADING
        ? {
            type: TOAST_TYPE.LOADING,
            title: props.title,
          }
        : {
            type: props.type,
            title: props.title,
            message: props.message,
            actionItems: props.actionItems,
          },
  });
};

export const setPromiseToast = <ToastData>(
  promise: Promise<ToastData>,
  options: PromiseToastOptions<ToastData>
): void => {
  toastManager.promise(promise, {
    loading: {
      data: {
        title: options.loading ?? "Loading…",
        type: TOAST_TYPE.LOADING,
        message: undefined,
        actionItems: undefined,
      },
    },
    success: (data) => ({
      data: {
        type: TOAST_TYPE.SUCCESS,
        title: options.success.title,
        message: options.success.message?.(data),
        actionItems: options.success.actionItems?.(data),
      },
    }),
    error: (data) => ({
      data: {
        type: TOAST_TYPE.ERROR,
        title: options.error.title,
        message: options.error.message?.(data),
        actionItems: options.error.actionItems?.(data),
      },
    }),
  });
};

export const dismissToast = (tId: string) => {
  toastManager.close(tId);
};
