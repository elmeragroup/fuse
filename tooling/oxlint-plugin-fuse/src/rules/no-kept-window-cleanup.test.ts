import { ruleTester } from "../rule-tester.ts";
import { noKeptWindowCleanup } from "./no-kept-window-cleanup.ts";

/** The import every case that reads `windowOf` or `windowShowing` starts with. */
const DOM_NODE = 'import { windowOf, windowShowing } from "../../internal/dom-node";';

/** A file two folders below `packages/fuse/src`, from which `DOM_NODE` reaches Fuse's module. */
const FILE = "/repo/packages/fuse/src/components/carousel/carousel-engine.ts";

ruleTester.run("no-kept-window-cleanup", noKeptWindowCleanup, {
  valid: [
    `${DOM_NODE} windowShowing(doc)?.cancelAnimationFrame(id);`,
    `${DOM_NODE} const shown = windowShowing(ownerDocument); shown?.cancelAnimationFrame(frame);`,
    // Read at cleanup time, inside the cleanup.
    `${DOM_NODE} useEffect(() => () => { windowShowing(doc)?.cancelAnimationFrame(id); });`,
    `${DOM_NODE} const shown = () => windowShowing(doc); function stop() { shown()?.cancelAnimationFrame(frame); }`,
    // A one-shot timeout whose callback the cleanup invalidates, cleared through the window at cleanup time.
    `${DOM_NODE} function pause() { windowShowing(doc)?.clearTimeout(pending.id); pending = null; }`,
    "const listening = new AbortController(); view.addEventListener('resize', refresh, { signal: listening.signal }); listening.abort();",
    "viewport.removeEventListener('scroll', onScroll);",
    "ownerDocument.removeEventListener('paste', onPaste);",
    "window.cancelAnimationFrame(frame);",
    "window.removeEventListener('resize', onResize);",
    "globalThis.clearTimeout(timer);",
    "clearTimeout(timer);",
    `${DOM_NODE} const style = windowOf(element).getComputedStyle(element);`,
    "const view = doc.defaultView; view?.requestAnimationFrame(step);",
    // Only Fuse's `windowOf` reads a node's window.
    'import { windowOf } from "./dom-node"; windowOf(node).cancelAnimationFrame(frame);',
    "function windowOf(node) { return globalThis; } windowOf(node).cancelAnimationFrame(frame);",
  ].map((code) => ({ code, filename: FILE })),
  invalid: [
    {
      // The carousel engine's teardown before this rule.
      code: "const view = viewport.ownerDocument.defaultView; view?.cancelAnimationFrame(frame);",
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // The chart's in-view watch before this rule.
      code: "const view = root.ownerDocument.defaultView ?? window; view.removeEventListener('resize', refresh); view.cancelAnimationFrame(frame);",
      errors: [
        { messageId: "keptListener" },
        { messageId: "keptWindow", data: { name: "cancelAnimationFrame" } },
      ],
    },
    {
      // The skeleton pane before this rule.
      code: `${DOM_NODE} const view = windowOf(skeleton); view.cancelAnimationFrame(frame);`,
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // The skeleton reveal's height ease before this rule.
      code: `${DOM_NODE} windowOf(resize.root).cancelAnimationFrame(resize.frame);`,
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // The skeleton reveal's input listeners before this rule, removed in a cleanup closure.
      code: `${DOM_NODE} const view = windowOf(root); const stop = () => { for (const type of TYPES) view.removeEventListener(type, note, options); };`,
      errors: [{ messageId: "keptListener" }],
    },
    {
      code: `${DOM_NODE} const view = windowOf(root); const kept = view; kept.clearTimeout(timer);`,
      errors: [{ messageId: "keptTimer", data: { name: "clearTimeout" } }],
    },
    {
      code: "doc.defaultView?.clearInterval(ticker);",
      errors: [{ messageId: "keptTimer", data: { name: "clearInterval" } }],
    },
    {
      code: `${DOM_NODE} windowOf(node).removeEventListener('blur', endAll);`,
      errors: [{ messageId: "keptListener" }],
    },
    {
      code: "const view = doc.defaultView; function stop() { view?.cancelAnimationFrame(wheelFrame); }",
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      code: "const { defaultView: view } = doc; view?.cancelAnimationFrame(frame);",
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      code: "const view = fallback ?? doc.defaultView; view.clearTimeout(timer);",
      errors: [{ messageId: "keptTimer", data: { name: "clearTimeout" } }],
    },
    {
      code: 'import { windowOf as nodeWindow } from "../../internal/dom-node"; nodeWindow(node).clearInterval(ticker);',
      errors: [{ messageId: "keptTimer", data: { name: "clearInterval" } }],
    },
    {
      // A window read at setup and called through by a returned cleanup.
      code: `${DOM_NODE} function watch(doc) { const shown = windowShowing(doc); return () => shown?.cancelAnimationFrame(frame); }`,
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      code: `${DOM_NODE} const shown = windowShowing(doc); const engine = { destroy() { shown?.clearTimeout(timer); } };`,
      errors: [{ messageId: "keptTimer", data: { name: "clearTimeout" } }],
    },
    {
      code: `${DOM_NODE} useEffect(() => { const shown = windowShowing(doc); return () => { shown?.cancelAnimationFrame(frame); }; });`,
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // Fuse's module, imported from beside it.
      code: 'import { windowOf } from "./dom-node"; windowOf(node).cancelAnimationFrame(frame);',
      filename: "/repo/packages/fuse/src/internal/own-click.ts",
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // Fuse's module, imported with the `.js` spelling Vite resolves to `dom-node.ts`.
      code: 'import { windowOf } from "./dom-node.js"; windowOf(node).cancelAnimationFrame(frame);',
      filename: "/repo/packages/fuse/src/internal/own-click.ts",
      errors: [{ messageId: "keptWindow", data: { name: "cancelAnimationFrame" } }],
    },
    {
      // A reused initial about:blank window keeps running the interval, and `windowShowing` gives null.
      code: `${DOM_NODE} function stop() { windowShowing(doc)?.clearInterval(ticker); }`,
      errors: [{ messageId: "keptTimer", data: { name: "clearInterval" } }],
    },
    {
      // A window that took a new document still holds the listener, and `windowShowing` gives null.
      code: `${DOM_NODE} windowShowing(doc)?.removeEventListener('resize', refresh);`,
      errors: [{ messageId: "keptListener" }],
    },
  ].map((item) => ({ filename: FILE, ...item })),
});
