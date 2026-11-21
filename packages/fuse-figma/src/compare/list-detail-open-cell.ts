/// <reference lib="dom" />
/**
 * The client renderers of the List detail overlay sets: the docs default demo's `ListDetail.Root`
 * with its customers and its first customer open, passing `showCloseButton={false}` as the demo
 * does, in a host as large as the viewport the definitions declare. The demo's `w-3xl` row holds its
 * `split="3xl"` root at the 48rem threshold, where the detail is a pane, so the renderers pass
 * `split="never"`, and the root picks the Sheet on its first render. `ListDetail.Detail` passes the
 * host to its Sheet as `container`, so the scrim and the panel portal into it, which is their
 * containing block, as `viewport-host.ts` says. The host exists only once the page mounts it, so the
 * renderers mount on the client.
 *
 * - `listDetailSheet`: the panel, measured alone; the page hides the scrim and the list.
 * - `listDetailOpen`: the panel over the scrim, measured together. Its host clips the panel's shadow
 *   where it falls past the viewport, as the browser window does and as the built Figma frame clips
 *   it.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { ListDetail } from "../../../fuse/dist/list-detail.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { LIST_DETAIL_DEMO_CLASSES as DEMO_CLASSES } from "../components/list-detail-text.ts";
import { SHEET_VIEWPORT } from "../components/sheet-text.ts";
import type { ClientCellRendering } from "./cell-renderers.ts";
import { customerDetail, customerList, DEMO_HOST_CLASSES as hostClasses } from "./list-detail-demo.ts";
import { viewportHost } from "./viewport-host.ts";

/** The demo's root with its first customer open, in a host that clips past it where `overflow` says. */
function openDetail(overflow: "visible" | "clip") {
  return viewportHost(
    SHEET_VIEWPORT,
    (host) =>
      createElement(LocaleProvider, {
        locale: "en-US",
        children: createElement(
          ListDetail.Root,
          { open: true, onOpenChange: () => undefined, split: "never", className: DEMO_CLASSES.root },
          customerList(true),
          createElement(
            ListDetail.Detail,
            { "aria-label": "Customer details", showCloseButton: false, container: host },
            customerDetail()
          )
        ),
      }),
    { overflow }
  );
}

/** The overlay layout's panel. */
export const listDetailSheet: ClientCellRendering = {
  hostClasses,
  element: () => openDetail("visible"),
};

/** The overlay layout, its scrim and its panel. */
export const listDetailOpen: ClientCellRendering = {
  hostClasses,
  element: () => openDetail("clip"),
  union: ["sheet-overlay", "list-detail-detail"],
};
