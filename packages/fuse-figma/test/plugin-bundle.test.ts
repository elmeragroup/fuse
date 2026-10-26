import { Effect } from "effect";
/**
 * The bundle `figma:plugin` writes for the plugin's main thread, loaded the way Figma loads it:
 * as one classic script whose only globals are the ones Figma provides. The in-memory file in
 * `plugin/src/fake-figma.ts` stands in for the document, and the UI is a channel the test drives.
 * The oracles are the change lines the one-variant Button kit plans on a file without its set, as
 * `plugin/src/reconcile.test.ts` lists them, and the messages the plugin shows for an unsynced
 * file and an unknown request.
 */
import { Script } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";

import { bundlePlugin } from "../scripts/plugin-bundle.ts";
import type { KitSpec } from "../src/components/kit-spec.ts";
import type { CollectionSpec } from "../src/variable-set.ts";

/**
 * The fixtures use the Figma plugin typings, which the root type check does not load, so the test
 * loads them by paths the check does not read.
 */
const BUTTON_KIT = "../plugin/src/button-kit-fixture.ts";
const FAKE_FIGMA = "../plugin/src/fake-figma.ts";

/** The in-memory file, as far as the test reads it. */
type FakeFile = { readonly figma: object };

type ButtonKitFixture = {
  readonly KIT: KitSpec;
  readonly fixture: (family: string, withPage?: boolean) => { readonly file: FakeFile };
};

type FakeFigmaModule = {
  readonly createFakeFigma: (options: { readonly collections: readonly CollectionSpec[] }) => FakeFile;
};

/** What `__html__` holds in the sandbox, which the bundle hands to `figma.showUI`. */
const HTML = "<p>The plugin UI</p>";

/** The options of a `figma.showUI` call that the plugin sets. */
type ShowUiOptions = { readonly width: number; readonly height: number; readonly themeColors: boolean };

/** A `figma.showUI` call. */
type ShowUiCall = { readonly html: string; readonly options: ShowUiOptions };

/** A message the main thread posts to the UI, as far as the sandbox reads it. */
type PostedMessage = { readonly kind: string };

/** The main thread, loaded in a sandbox over one file. */
type LoadedPlugin = {
  /** Each `figma.showUI` call. */
  readonly shown: readonly ShowUiCall[];
  /**
   * Post a request as the UI does, and wait for the next message the main thread posts back.
   *
   * @param request - What the UI asks for.
   * @returns The message, cloned as Figma clones what crosses to the UI.
   */
  readonly ask: (request: string) => Promise<PostedMessage>;
};

/**
 * Run the bundle as a classic script whose globals are only `figma`, `__html__`, `setTimeout`,
 * `clearTimeout` and `console`. A classic script cannot hold an `import` or `export` statement,
 * so running at all shows the bundle has neither.
 *
 * @param code - The bundle.
 * @param file - The file the plugin runs on.
 * @returns The sandboxed plugin.
 */
function load(code: string, file: FakeFile): LoadedPlugin {
  const shown: ShowUiCall[] = [];
  const replies: ((message: PostedMessage) => void)[] = [];
  let onmessage: ((request: string) => void) | undefined;
  const ui = {
    postMessage: (message: PostedMessage) => {
      replies.shift()?.(structuredClone(message));
    },
    get onmessage() {
      return onmessage;
    },
    set onmessage(handler: ((request: string) => void) | undefined) {
      onmessage = handler;
    },
  };
  // The fake models the document and its variables. Figma adds the UI channel beside them.
  const figma = {
    showUI: (html: string, options: ShowUiOptions) => {
      shown.push({ html, options });
    },
    ui,
  };
  Reflect.setPrototypeOf(figma, file.figma);
  new Script(code, { filename: "code.js" }).runInNewContext({
    figma,
    __html__: HTML,
    setTimeout,
    clearTimeout,
    console,
  });
  return {
    shown,
    ask: (request) =>
      new Promise((resolve, reject) => {
        if (onmessage === undefined) {
          reject(new Error("the plugin set no figma.ui.onmessage handler"));
          return;
        }
        replies.push(resolve);
        onmessage(request);
      }),
  };
}

/** What the kit changes on the fixture's file, which holds a stale preview and no Button set. */
const CHANGES = [
  "Fuse components: delete Old preview",
  "Fuse components: create the Icons frame with 0 icons",
  "Fuse components: create the component set Button with 1 variants",
  "Fuse components: place Button and Icons in a row",
];

describe("the plugin bundle", () => {
  let fixtures: ButtonKitFixture & FakeFigmaModule;
  let code: string;

  beforeAll(async () => {
    // SAFETY: the paths name button-kit-fixture.ts and fake-figma.ts, which export these members
    // with these shapes.
    const buttonKit = (await import(BUTTON_KIT)) as ButtonKitFixture;
    // SAFETY: as above.
    const fake = (await import(FAKE_FIGMA)) as FakeFigmaModule;
    fixtures = { ...buttonKit, ...fake };
    code = await Effect.runPromise(bundlePlugin(buttonKit.KIT));
  });

  it("loads as a classic script with only Figma's globals and opens the UI", () => {
    const plugin = load(code, fixtures.fixture("Roboto").file);
    expect(plugin.shown).toEqual([{ html: HTML, options: { width: 560, height: 640, themeColors: true } }]);
  });

  it("answers a plan request with the kit's change lines", async () => {
    const plugin = load(code, fixtures.fixture("Roboto").file);
    expect(await plugin.ask("plan")).toEqual({ kind: "plan", changes: CHANGES, warnings: [] });
  });

  it("answers an apply request with the lines it applied and none remaining", async () => {
    const plugin = load(code, fixtures.fixture("Roboto").file);
    expect(await plugin.ask("apply")).toEqual({
      kind: "applied",
      changes: CHANGES,
      remaining: [],
      warnings: [],
    });
  });

  it("answers a request it does not know with an error", async () => {
    const plugin = load(code, fixtures.fixture("Roboto").file);
    expect(await plugin.ask("undo")).toEqual({
      kind: "error",
      message: "The plugin UI sent an unknown request: undo",
    });
  });

  it("answers with the sync hint on a file the token sync never wrote", async () => {
    const plugin = load(code, fixtures.createFakeFigma({ collections: [] }));
    expect(await plugin.ask("plan")).toEqual({
      kind: "error",
      message: "The file has no local collection named Fuse tokens. Run `figma:sync` on this file first.",
    });
  });
});
