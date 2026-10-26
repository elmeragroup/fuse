/// <reference lib="dom" />
/**
 * The browser side of the client cells: the page's bundle calls {@link mountClientCells}, which
 * mounts each client cell's element in its slot with React's `createRoot`. The renderer opens the
 * overlay with `defaultOpen` and portals its popup into the slot through the `container` prop. The
 * mount then waits for the fonts the cells' text uses, since a late face moves a popup placed
 * against its trigger, and for two animation frames, in which Base UI places the popup. The page
 * stops every animation and transition, so the popup shows its open face at once.
 *
 * Base UI marks an open Select's selected item `data-highlighted`, and with several Selects on the
 * page the last one opened keeps focus on its item, which Fuse's `focus:` row draws highlighted.
 * A cell draws its highlight only where the page forces it, so the mount then blurs the element a
 * client slot holds focus on, removes every `data-highlighted` in a client slot, and waits a frame,
 * after which the page checks that neither came back.
 *
 * Base UI appends U+2060 WORD JOINER to a live region's text on mount, as Combobox's Empty and Status
 * do, and removes it 200 ms later, so the mount waits until no client slot's text holds the marker
 * before the page reads its markup. The mount marks `<html>` with {@link MOUNTED} when it is done, or
 * with the reason it failed.
 *
 * This module runs only in the browser, inside the bundle `client-bundle.ts` builds.
 */

import { Schema } from "effect";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { ClientCellRendering } from "./cell-renderers.ts";
import { CLIENT_HIDDEN, MOUNTED, MOUNTED_DONE } from "./preview-page.ts";

/** No BOOLEAN property turned on, as a preview shows every property at its default. */
const AT_DEFAULTS: ReadonlySet<string> = new Set();

/** A slot's `data-compare-props`, which `previewDocument` writes as the cell's JSON. */
const parseCell = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.String))
);

/** The character Base UI appends to a live region's text on mount, for 200 ms. */
const LIVE_REGION_MARKER = "\u2060";

/** About five times the 200 ms Base UI keeps its marker, at 60 frames a second. */
const LIVE_REGION_MARKER_FRAMES = 60;

function animationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

async function mount(renderings: ReadonlyMap<string, ClientCellRendering>): Promise<void> {
  // A render that throws unmounts its root and leaves the slot empty, so the mount fails with it.
  const failures: unknown[] = [];
  for (const slot of document.querySelectorAll<HTMLElement>(CLIENT_HIDDEN)) {
    const set = slot.dataset.compareClient ?? "";
    const rendering = renderings.get(set);
    if (rendering === undefined) {
      throw new Error(`the client bundle renders no set ${set}`);
    }
    // The root's own element takes no box, so the trigger lays out in the slot as static markup does.
    const root = document.createElement("div");
    root.style.display = "contents";
    slot.append(root);
    const element = rendering.element(parseCell(slot.dataset.compareProps ?? ""), AT_DEFAULTS, slot);
    flushSync(() => {
      createRoot(root, {
        onUncaughtError: (error) => {
          failures.push(error);
        },
      }).render(element);
    });
  }
  if (failures.length > 0) {
    throw new Error(`a client cell failed to render: ${failures.map(String).join("; ")}`);
  }
  // Reading a layout value lays the page out, which requests every face its text uses.
  void document.body.offsetHeight;
  await document.fonts.ready;
  await animationFrame();
  await animationFrame();
  settle();
  await animationFrame();
  await liveRegionsRestored();
}

/** Wait, a frame at a time, until no client slot's text holds Base UI's live-region marker. */
async function liveRegionsRestored(): Promise<void> {
  for (let frame = 0; ; frame++) {
    const marked = [...document.querySelectorAll<HTMLElement>(CLIENT_HIDDEN)].find((slot) =>
      slot.textContent.includes(LIVE_REGION_MARKER)
    );
    if (marked === undefined) {
      return;
    }
    if (frame >= LIVE_REGION_MARKER_FRAMES) {
      throw new Error(
        `the live-region marker stayed in set ${marked.dataset.compareClient ?? ""} for ${LIVE_REGION_MARKER_FRAMES} frames`
      );
    }
    await animationFrame();
  }
}

/** Clear the focus and the highlights Base UI set on open inside the client slots. */
function settle(): void {
  for (const slot of document.querySelectorAll<HTMLElement>(CLIENT_HIDDEN)) {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && slot.contains(focused)) {
      focused.blur();
    }
    for (const highlighted of slot.querySelectorAll("[data-highlighted]")) {
      highlighted.removeAttribute("data-highlighted");
    }
  }
}

/**
 * Mount every client cell on the page, and mark `<html>` with {@link MOUNTED} once every popup has
 * its place: {@link MOUNTED_DONE}, or the reason the mount failed, such as a slot that names a set
 * no rendering renders, which the run's plan rules out.
 *
 * @param renderings - The client renderings, by the key of the definition each renders.
 */
export async function mountClientCells(renderings: ReadonlyMap<string, ClientCellRendering>): Promise<void> {
  try {
    await mount(renderings);
    document.documentElement.setAttribute(MOUNTED, MOUNTED_DONE);
  } catch (error) {
    document.documentElement.setAttribute(MOUNTED, String(error));
  }
}
