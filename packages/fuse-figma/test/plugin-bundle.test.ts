/**
 * The bundle `figma:plugin` writes for the plugin's main thread, loaded the way Figma loads it:
 * as one classic script whose only globals are the ones Figma provides. The in-memory file in
 * `plugin/src/fake-figma.ts` stands in for the document, and the UI is a channel the test drives.
 * The oracles are the change lines the one-variant Button kit plans on a file without its set, as
 * `plugin/src/reconcile.test.ts` lists them, and the messages the plugin shows for an unsynced
 * file and an unknown request.
 */

import { Effect } from "effect";
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
const KIT_FIXTURE = "../plugin/src/kit-fixture.ts";

/** The in-memory file, as far as the test reads it. */
type FakeFile = { readonly figma: object };

type ButtonKitFixture = {
  readonly KIT: KitSpec;
  readonly fixture: (family: string, withPage?: boolean) => { readonly file: FakeFile };
};

type KitFixtureModule = {
  readonly kitFixture: () => Promise<{
    readonly kit: KitSpec;
    readonly collections: readonly CollectionSpec[];
  }>;
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
   * @param kind - The kind of message to wait for, such as the export's last one. Without it, the
   *   next message of any kind.
   * @returns The message, cloned as Figma clones what crosses to the UI.
   */
  readonly ask: (request: string, kind?: string) => Promise<PostedMessage>;
  /** Every message the main thread posted, in order. */
  readonly posted: readonly PostedMessage[];
  /** How many times the bundle has called `setTimeout`, each a turn Figma could redraw or edit in. */
  readonly timers: () => number;
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
  const posted: PostedMessage[] = [];
  const waiting: { readonly kind: string | undefined; readonly resolve: (message: PostedMessage) => void }[] =
    [];
  let onmessage: ((request: string) => void) | undefined;
  const ui = {
    postMessage: (message: PostedMessage) => {
      const clone = structuredClone(message);
      posted.push(clone);
      const [next] = waiting;
      if (next !== undefined && (next.kind === undefined || next.kind === clone.kind)) {
        waiting.shift();
        next.resolve(clone);
      }
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
  // Effect looks `setTimeout` up when it schedules, so a counter in place from the start sees every call.
  let timers = 0;
  const countedTimeout = (handler: () => void, delay?: number) => {
    timers += 1;
    return setTimeout(handler, delay);
  };
  new Script(code, { filename: "code.js" }).runInNewContext({
    figma,
    __html__: HTML,
    setTimeout: countedTimeout,
    clearTimeout,
    console,
  });
  return {
    timers: () => timers,
    shown,
    posted,
    ask: (request, kind) =>
      new Promise((resolve, reject) => {
        if (onmessage === undefined) {
          reject(new Error("the plugin set no figma.ui.onmessage handler"));
          return;
        }
        waiting.push({ kind, resolve });
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

  // Effect hands the thread back through `setTimeout` every 2048 operations unless the program runs
  // under `Scheduler.PreventSchedulerYield`, and each such turn lets Figma redraw or take an edit in
  // the middle of a run. The run awaits only the fake's settled promises, which resolve without one.
  // The whole kit runs long enough between awaits to reach that budget, where the one-variant kit
  // does not: without the reference, its Apply and Plan took 145 turns on 2026-10-26.
  // The snapshot export hands the thread back once after each preview frame, so the progress it
  // posted reaches the UI while it runs.
  it("plans and applies the whole kit without handing the thread back, and exports with a turn per preview", async () => {
    // SAFETY: the path names kit-fixture.ts, whose `kitFixture` resolves to the built kit and the
    // collections the token sync writes.
    const { kitFixture } = (await import(KIT_FIXTURE)) as KitFixtureModule;
    const { kit, collections } = await kitFixture();
    const plugin = load(
      await Effect.runPromise(bundlePlugin(kit)),
      fixtures.createFakeFigma({ collections })
    );
    expect((await plugin.ask("apply")).kind).toBe("applied");
    expect((await plugin.ask("plan")).kind).toBe("plan");
    expect(plugin.timers()).toBe(0);

    const before = plugin.posted.length;
    expect((await plugin.ask("snapshots", "snapshots")).kind).toBe("snapshots");
    const total = kit.previews.reduce(
      (sum, preview) => sum + preview.groups.reduce((count, group) => count + group.variants.length, 0),
      0
    );
    expect(plugin.posted.slice(before)).toEqual([
      ...Array.from({ length: total }, (_, index) => ({ kind: "progress", done: index + 1, total })),
      expect.objectContaining({ kind: "snapshots" }),
    ]);
    expect(plugin.timers()).toBe(kit.previews.length);
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
