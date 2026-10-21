/**
 * Export a snapshot of every instance in the kit's preview frames, for `figma:compare`. Each
 * instance becomes a PNG at twice the canvas size, cut to its render bounds, so a focus ring
 * drawn outside the box is in the picture. The export reads the file and writes nothing.
 */

import { SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from "../../src/compare/snapshot.ts";
import type {
  CanvasRect,
  InstanceSnapshot,
  KitSnapshot,
  PreviewSnapshot,
} from "../../src/compare/snapshot.ts";
import type { ModeRef } from "../../src/components/kit-spec.ts";
import { keyOf } from "./identity.ts";

/** Device pixels per canvas pixel, the browser's device scale factor in the comparison. */
const SCALE = 2;

/** Every preview frame's key starts with this. */
const PREVIEW_PREFIX = "preview/";

/** Reports how many instances the export has written so far. */
export type SnapshotProgress = (done: number, total: number) => void;

const isFrame = (node: BaseNode): node is FrameNode => node.type === "FRAME";
const isInstance = (node: BaseNode): node is InstanceNode => node.type === "INSTANCE";

function rect({ x, y, width, height }: Rect): CanvasRect {
  return { x, y, width, height };
}

/** Lets Figma redraw and handle input between frames. */
function yieldToFigma(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function kitPage(figma: PluginAPI, pageKey: string): Promise<PageNode> {
  const pages = figma.root.children.filter((node) => keyOf(node) === pageKey);
  const [page, ...others] = pages;
  if (page === undefined) {
    throw new Error(`This file has no kit page with the key ${pageKey}. Apply the kit first.`);
  }
  if (others.length > 0) {
    throw new Error(`This file has ${pages.length} pages with the key ${pageKey}. Delete the copies first.`);
  }
  await page.loadAsync();
  return page;
}

/**
 * The mode a preview frame reads each collection in, inherited and default modes included.
 * Figma's `resolvedVariableModes` lists only the collections the frame's layers bind or alias
 * into, as a real file showed on 2026-10-21 (rule 11 in `fake-figma.ts`), so a Badge preview
 * that pins `Fuse density` resolves no density mode. A collection the frame or its page pins
 * and the resolved modes leave out takes the nearest pin, which is the mode the frame would
 * resolve. A collection nothing pins or binds, such as `Fuse primitives`, stays out.
 */
async function resolvedModes(figma: PluginAPI, page: PageNode, frame: FrameNode): Promise<ModeRef[]> {
  const modeIds = {
    ...page.explicitVariableModes,
    ...frame.explicitVariableModes,
    ...frame.resolvedVariableModes,
  };
  const modes: ModeRef[] = [];
  for (const [collectionId, modeId] of Object.entries(modeIds)) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
    const mode = collection?.modes.find((candidate) => candidate.modeId === modeId);
    if (collection !== null && mode !== undefined) {
      modes.push({ collection: collection.name, mode: mode.name });
    }
  }
  return modes.sort((left, right) => left.collection.localeCompare(right.collection));
}

/**
 * The variant an instance shows. The main component's key names it, and an instance whose main
 * component carries no key falls back on the variant part of its own key.
 */
async function variantOf(instance: InstanceNode, previewKey: string): Promise<string> {
  const main = await instance.getMainComponentAsync();
  const fromMain = main === null ? "" : keyOf(main);
  return fromMain === "" ? keyOf(instance).slice(previewKey.length + 1) : fromMain;
}

async function snapshotInstance(
  figma: PluginAPI,
  instance: InstanceNode,
  previewKey: string
): Promise<InstanceSnapshot | undefined> {
  const box = instance.absoluteBoundingBox;
  if (box === null) {
    return undefined;
  }
  const renderBounds = instance.absoluteRenderBounds;
  const image =
    renderBounds === null
      ? null
      : {
          renderBounds: rect(renderBounds),
          png: figma.base64Encode(
            await instance.exportAsync({
              format: "PNG",
              constraint: { type: "SCALE", value: SCALE },
              colorProfile: "SRGB",
            })
          ),
        };
  return { key: keyOf(instance), variant: await variantOf(instance, previewKey), box: rect(box), image };
}

/**
 * The kit's instances under a preview frame, at any depth, in layer order. The walk enters
 * frames, such as a set's group, and stops at an instance.
 */
function instancesOf(frame: FrameNode, previewKey: string): InstanceNode[] {
  return frame.children.flatMap((node) => {
    if (isInstance(node)) {
      return keyOf(node).startsWith(`${previewKey}/`) ? [node] : [];
    }
    return isFrame(node) ? instancesOf(node, previewKey) : [];
  });
}

/**
 * Export every instance of every preview frame on the kit's pages.
 *
 * @param figma - The plugin API.
 * @param pageKeys - The kit's page keys, from `KitSpec.pages`, in the order to export them.
 * @param progress - Called after each instance with the count so far and the total.
 * @returns The snapshot, ready for `JSON.stringify`.
 * @throws When the file lacks a kit page, or holds more than one with a key.
 */
export async function exportSnapshots(
  figma: PluginAPI,
  pageKeys: readonly string[],
  progress: SnapshotProgress
): Promise<KitSnapshot> {
  const frames: {
    readonly page: PageNode;
    readonly frame: FrameNode;
    readonly instances: InstanceNode[];
  }[] = [];
  for (const pageKey of pageKeys) {
    const page = await kitPage(figma, pageKey);
    for (const node of page.children) {
      if (isFrame(node) && keyOf(node).startsWith(PREVIEW_PREFIX)) {
        frames.push({ page, frame: node, instances: instancesOf(node, keyOf(node)) });
      }
    }
  }
  const total = frames.reduce((sum, { instances }) => sum + instances.length, 0);
  let done = 0;
  const previews: PreviewSnapshot[] = [];
  for (const { page, frame, instances: found } of frames) {
    const key = keyOf(frame);
    const instances: InstanceSnapshot[] = [];
    for (const instance of found) {
      const snapshot = await snapshotInstance(figma, instance, key);
      if (snapshot !== undefined) {
        instances.push(snapshot);
      }
      done += 1;
      progress(done, total);
    }
    previews.push({ key, name: frame.name, modes: await resolvedModes(figma, page, frame), instances });
    await yieldToFigma();
  }
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    file: figma.root.name,
    scale: SCALE,
    previews,
  };
}
