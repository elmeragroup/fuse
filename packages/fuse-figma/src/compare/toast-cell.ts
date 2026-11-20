/// <reference lib="dom" />
/**
 * The client renderer of the `toast` set: the docs default demo's stack, holding one toast the
 * manager raised before the provider mounted, with the cell's status and no timeout, so it stays.
 */

import { createElement, useRef, useState } from "react";
import type { ReactElement } from "react";

import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { Toast } from "../../../fuse/dist/toast.js";
import type { Cell } from "../components/component-spec.ts";
import { TOAST_DEMO_CLASSES, TOAST_DESCRIPTION, TOAST_TITLE, toastStatus } from "../components/toast-text.ts";
import type { ToastStatus } from "../components/toast-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";

function DemoStack({ status }: { readonly status: ToastStatus }): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [manager] = useState(() => {
    const created = Toast.createToastManager();
    const toast = { title: TOAST_TITLE, description: TOAST_DESCRIPTION, timeout: 0 };
    // A neutral toast sets no `type`, as the docs default demo raises it.
    created.add(status === "neutral" ? toast : { ...toast, type: status });
    return created;
  });
  return createElement(
    "div",
    { ref: host, className: TOAST_DEMO_CLASSES.host },
    createElement(Toast.Provider, {
      toastManager: manager,
      children: createElement(Toast.Viewport, { container: host, className: TOAST_DEMO_CLASSES.viewport }),
    })
  );
}

/** A `toast` cell: the demo's stack with its one toast. */
export const toast: ClientCellRendering = {
  hostClasses: [...new Set(Object.values(TOAST_DEMO_CLASSES).flatMap((classes) => classes.split(" ")))],
  element: (cell: Cell) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(DemoStack, { status: toastStatus(cell.status) }),
    }),
};
