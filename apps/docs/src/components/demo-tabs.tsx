"use client";

import { Fragment, Suspense, lazy, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import { tv } from "tailwind-variants";

import { Frame } from "@elmeragroup/fuse/frame";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { LiveCodeStore } from "../lib/live-code/store";
import { DocsCodePre } from "./docs-code-pre";
import { LiveCodeContext } from "./live-code/lens";
import { LiveCodeFrame } from "./live-code/live-code-frame";
import { CopySourceButton, useHighlightedSource } from "./source-code";
import { SourceSheet } from "./source-sheet";

// Live code's Code view, with its source scanner and markup patcher, loads when a reader first opens
// a component demo's Code view, and its stage editor, with its menus, when a stage first comes near
// the viewport, so no page ships either upfront.
const LiveCodeView = lazy(async () => ({
  default: (await import("./live-code/live-code-view")).LiveCodeView,
}));
const StageEditor = lazy(async () => ({
  default: (await import("./live-code/stage-editor")).StageEditor,
}));

/** Which Code view a frame has: Live code, or the plain source with its actions. */
type DemoCodeView = "live" | "static";

type DemoTabsProps = {
  /** The demo's title as plain text, for the Sheet title and the view switch's name. */
  title: string;
  /** The heading that names the frame, rendered inside `Frame.Title`; a default stage has none. */
  heading?: ReactNode;
  /**
   * The Code view. `live` makes the stage's parts editable in place and keeps the stage in view,
   * with the edited source beneath it; component pages use it. `static` swaps the stage for the
   * source.
   */
  codeView: DemoCodeView;
  /** The demo file name, the header of the Sheet's code frame. */
  file: string;
  /** The theme-tinted stage with the demo in it. */
  stage: ReactNode;
  /**
   * The demo file's raw source, which the copy action writes to the clipboard and the Code view
   * shows until its highlighted markup arrives.
   */
  sourceText: string;
  /** The route that serves the source's highlighted markup, fetched when the Code view first shows. */
  sourceHref: string;
};

const demoTabs = tv({
  slots: {
    // The Frame root and the panel give up the `relative` the Frame gives them, so no ancestor of
    // the stage is positioned and the popups a demo portals into its stage take the document as
    // their containing block, as on a page without the frame. A positioned ancestor moves them:
    // Base UI scrolls a Combobox's selected item into view on the frame after it opens, before it
    // places the popup against its real containing block, so the item sits that ancestor's offset
    // too low and the page scrolls to it.
    root: "static",
    panel: "static",
    footer: "items-end",
    // The panel's padding belongs to the stage and the code view, which carry their own: the
    // views pull out by the panel's padding into a wrapper that takes the panel's corners and
    // clips them. The wrapper is not positioned, so its clip cuts the stage's background and
    // leaves whole the popups whose containing block is the document.
    bleed: "-m-(--surface-pad-lg) overflow-hidden rounded-[inherit]",
    // The code view is a stacking context of its own, so its actions sit above the code and
    // never above the page's sticky header. It takes the height the Demo view had when the Code
    // tab was chosen, so switching views never moves the footer or the page below it; the code
    // scrolls inside that height, and the Sheet shows it whole.
    codeView: "relative isolate h-(--demo-height) bg-card",
    // The stage editor's place in a Live code frame's footer, at the inline start opposite the
    // view switch, which is taller than the control. It is positioned for the editor's part
    // outline, which it holds beside the control, and it is no ancestor of the stage. Its z-index
    // is the least that stacks it above the backdrop a demo's open modal popup lays over the page,
    // which stacks at `auto`, so the control still takes a press, which closes that popup. It
    // stays below the docs header's `z-10`, so the header keeps the pointer where they overlap.
    stageControlSlot: "relative z-1 flex",
    // The actions float in the code's top end corner and stay put while the code scrolls.
    actions: "absolute end-3 top-3 z-10",
    // The vertical scroll area holds the code block to its width, so the block scrolls its long
    // lines itself, under its own horizontal scrollbar.
    code: "h-full",
  },
  variants: {
    // A Live code frame's footer holds the stage control beside the view switch.
    live: { true: { footer: "flex-row items-center justify-between" } },
  },
});

const { panel, bleed, codeView, actions, code } = demoTabs();

/** The two views a demo frame switches between. */
type DemoView = "demo" | "code";

/** What the shell hands the panels: the view state, the tab wiring and the demo's parts. */
type DemoPanelsProps = {
  view: DemoView;
  /** Whether the Code view has shown once; its actions and highlighted markup wait for it. */
  shown: boolean;
  /** The id of a view's tab, which names its panel. */
  tabId: (of: DemoView) => string;
  /** The id of a view's panel, which its tab controls. */
  panelId: (of: DemoView) => string;
  /** Takes the Demo view's element, which the shell measures before the Code view replaces it. */
  demoViewRef: (element: HTMLDivElement | null) => void;
  /** The Demo view's element, once mounted. */
  demoView: HTMLDivElement | null;
  /** The Demo view's height when the Code tab was chosen, in px. */
  demoHeight: number | undefined;
  title: string;
  file: string;
  stage: ReactNode;
  sourceText: string;
  /** The highlighted markup, or `null` until it arrives. */
  html: string | null;
};

/** The plain source block, which a Code view shows until its highlighted markup arrives. */
function sourceBlock(sourceText: string, html: string | null): ReactElement {
  return <DocsCodePre variant="embedded" code={html === null ? { text: sourceText } : { html }} />;
}

/**
 * A handbook or block demo's views. The Code view replaces the stage at the stage's height, and
 * once it shows it carries a toolbar that copies the source and opens it in a Sheet, and scrolls
 * the source in a scroll area. Mounting those on first show keeps a page of demos from hydrating
 * and measuring a toolbar, a Sheet and a scroll area per demo that nobody has opened.
 */
function StaticCodePanels({
  view,
  shown,
  tabId,
  panelId,
  demoViewRef,
  demoHeight,
  title,
  file,
  stage,
  sourceText,
  html,
}: DemoPanelsProps): ReactElement {
  const source = sourceBlock(sourceText, html);
  return (
    <>
      {/* The views leave the tab order: the wrapper's clip would hide a focused view's ring,
          and a keyboard reaches the demo's own controls and the code's actions instead. */}
      <div
        ref={demoViewRef}
        role="tabpanel"
        id={panelId("demo")}
        aria-labelledby={tabId("demo")}
        hidden={view !== "demo"}
        tabIndex={-1}>
        {stage}
      </div>
      <div
        role="tabpanel"
        id={panelId("code")}
        aria-labelledby={tabId("code")}
        hidden={view !== "code"}
        tabIndex={-1}
        data-demo-source
        className={codeView()}
        style={{ "--demo-height": demoHeight === undefined ? undefined : `${demoHeight}px` }}>
        {shown ? (
          <>
            <Toolbar.Root aria-label={`${title} code`} className={actions()}>
              <CopySourceButton
                toolbar
                sourceText={sourceText}
                label="Copy code"
                copiedStatus="Code copied to the clipboard"
              />
              <SourceSheet
                title={title}
                file={file}
                sourceText={sourceText}
                code={html === null ? { text: sourceText } : { html }}
              />
            </Toolbar.Root>
            <ScrollArea.Root className={code()}>{source}</ScrollArea.Root>
          </>
        ) : (
          // Until the view first shows, it holds the plain source alone. The toolbar, the Sheet
          // and the scroll area, which measures itself as it mounts, wait for the reader.
          <div className={code()}>{source}</div>
        )}
      </div>
    </>
  );
}

/**
 * Whether a Live code frame's stage editor should load: once the frame comes near the viewport,
 * so its stage control is there by the time a keyboard reaches the frame, or once the pointer or
 * focus enters the frame, its header and footer included. A frame with no editor passes `null`
 * and is never watched.
 */
function useStageEditorWanted(frame: RefObject<HTMLElement | null> | null): boolean {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    const host = frame?.current ?? null;
    if (wanted || host === null) return;
    const want = (): void => setWanted(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) want();
      },
      { rootMargin: "200px" }
    );
    observer.observe(host);
    host.addEventListener("pointerenter", want);
    host.addEventListener("focusin", want);
    return () => {
      observer.disconnect();
      host.removeEventListener("pointerenter", want);
      host.removeEventListener("focusin", want);
    };
  }, [frame, wanted]);
  return wanted;
}

type LiveCodePanelsProps = DemoPanelsProps & {
  /** The footer slot the stage editor puts its control in, once it should load, else `null`. */
  controlSlot: HTMLElement | null;
};

/**
 * A component demo's views. The stage takes Live code's stage editor, whose control sits in the
 * frame's footer, and stays in view under the Code tab with the edited source beneath it. The
 * frame's Live code store is made here, so only Live code frames hold one; the stage's lensed
 * parts, the editor and the Code view share it.
 */
function LiveCodePanels({
  view,
  shown,
  tabId,
  panelId,
  demoViewRef,
  demoView,
  title,
  file,
  stage,
  sourceText,
  html,
  controlSlot,
}: LiveCodePanelsProps): ReactElement {
  const [store] = useState(() => new LiveCodeStore());
  const generation = useSyncExternalStore(store.subscribe, store.getGeneration, store.getGeneration);
  const content = html === null ? { text: sourceText } : { html };
  return (
    <LiveCodeContext value={store}>
      {/* The stage stays in view under the Code tab, so it is the Demo tab's panel only while that
          tab is selected. */}
      <div
        ref={demoViewRef}
        role={view === "demo" ? "tabpanel" : undefined}
        id={panelId("demo")}
        aria-labelledby={view === "demo" ? tabId("demo") : undefined}
        tabIndex={-1}>
        {/* Reset remounts the stage, which also drops an error a boundary inside it latched. */}
        <Fragment key={generation}>{stage}</Fragment>
        {demoView !== null && controlSlot !== null ? (
          <Suspense fallback={null}>
            <StageEditor store={store} host={demoView} slot={controlSlot} sourceText={sourceText} />
          </Suspense>
        ) : null}
      </div>
      <div
        role="tabpanel"
        id={panelId("code")}
        aria-labelledby={tabId("code")}
        hidden={view !== "code"}
        tabIndex={-1}
        data-demo-source>
        {shown ? (
          // The view's frame around the plain source holds its place while its code loads, so the
          // demo keeps its height when the view arrives.
          <Suspense
            fallback={
              <LiveCodeFrame
                title={title}
                file={file}
                source={<DocsCodePre variant="embedded" code={content} />}
              />
            }>
            <LiveCodeView store={store} title={title} file={file} sourceText={sourceText} html={html} />
          </Suspense>
        ) : (
          // Until the view first shows, the hidden panel holds the plain source alone.
          <div className={code()}>{sourceBlock(sourceText, html)}</div>
        )}
      </div>
    </LiveCodeContext>
  );
}

/**
 * A demo's frame chrome: a flush Frame whose header names the demo, whose panel shows the Demo or
 * the Code view, and whose footer switches between them.
 *
 * The Tabs root holds the switch alone, and the views are tabpanels the panels wire to its tabs.
 * Base UI's Tabs register their tabs and panels in layout effects, which changes the root's
 * context in the commit that hydrates the page. React can't see into a demo's Suspense boundary
 * before it hydrates, so a context change above that boundary throws the page's hydration render
 * away, hydrates that demo and renders the rest again, once per demo. With the stage outside the
 * Tabs, the page hydrates its demos in one pass. Both views stay mounted: the demo keeps its state
 * while the code shows, and the Code view, marked `[data-demo-source]`, puts the source in the
 * server HTML for the tools that read it, as plain text until the view first shows and its
 * highlighted markup arrives.
 *
 * `codeView` picks the panels. Either Code view, once shown, has a toolbar that copies the source
 * and an "Open code" action that shows it whole in a Sheet headed with the file name; Live code's
 * Code view, Sheet and Copy carry the edits the reader made on the stage. A Live code frame also
 * holds the stage editor's control in the footer, after the stage and before the view switch in
 * the tab order. It stays there under either view.
 */
export function DemoTabs({
  title,
  heading,
  codeView: kind,
  file,
  stage,
  sourceText,
  sourceHref,
}: DemoTabsProps): ReactElement {
  // State rather than a ref: the stage editor observes the element once it mounts.
  const [demoView, demoViewRef] = useState<HTMLDivElement | null>(null);
  const [view, setView] = useState<DemoView>("demo");
  const [demoHeight, setDemoHeight] = useState<number>();
  const id = useId();
  const tabId = (of: DemoView): string => `${id}-${of}-tab`;
  const panelId = (of: DemoView): string => `${id}-${of}`;
  // The highlighted source loads when the Code view first shows.
  const [shown, setShown] = useState(false);
  const html = useHighlightedSource(sourceHref, shown);
  const live = kind === "live";
  const { root, footer, stageControlSlot } = demoTabs({ live });
  // State rather than a ref: the editor portals into the slot once it mounts.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const editing = useStageEditorWanted(live ? frame : null);

  const panels: DemoPanelsProps = {
    view,
    shown,
    tabId,
    panelId,
    demoViewRef,
    demoView,
    demoHeight,
    title,
    file,
    stage,
    sourceText,
    html,
  };

  // Read while the Demo view still shows: a static Code view then opens at the height it leaves.
  function rememberDemoHeight(): void {
    const height = demoView?.getBoundingClientRect().height;
    if (height !== undefined && height > 0) setDemoHeight(height);
  }

  return (
    <Frame.Root ref={frame} layout="flush" className={root()}>
      {heading === undefined ? null : (
        <Frame.Header>
          <Frame.Title>{heading}</Frame.Title>
        </Frame.Header>
      )}
      <Frame.Panel className={panel()}>
        <div className={bleed()}>
          {live ? (
            <LiveCodePanels {...panels} controlSlot={editing ? slot : null} />
          ) : (
            <StaticCodePanels {...panels} />
          )}
        </div>
      </Frame.Panel>
      <Frame.Footer className={footer()}>
        {live ? <div ref={setSlot} className={stageControlSlot()} /> : null}
        <Tabs.Root
          value={view}
          onValueChange={(value) => {
            if (value === "code") {
              rememberDemoHeight();
              setShown(true);
            }
            setView(value === "code" ? "code" : "demo");
          }}>
          <Tabs.List aria-label={`${title} view`}>
            <Tabs.Trigger value="demo" id={tabId("demo")} aria-controls={panelId("demo")}>
              Demo
            </Tabs.Trigger>
            <Tabs.Trigger value="code" id={tabId("code")} aria-controls={panelId("code")}>
              Code
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </Frame.Footer>
    </Frame.Root>
  );
}
