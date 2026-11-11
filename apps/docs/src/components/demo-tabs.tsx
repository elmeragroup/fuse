"use client";

import { useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Frame } from "@elmeragroup/fuse/frame";
import { ArrowsOut } from "@elmeragroup/fuse/icons";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { DocsCodePre } from "./docs-code-pre";
import { CopySourceButton, useHighlightedSource } from "./source-code";

type DemoTabsProps = {
  /** The demo's title as plain text, for the Sheet title and the view switch's name. */
  title: string;
  /** The heading that names the frame, rendered inside `Frame.Title`. */
  heading: ReactNode;
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
    // The actions float in the code's top end corner and stay put while the code scrolls.
    actions: "absolute end-3 top-3 z-10",
    // The vertical scroll area holds the code block to its width, so the block scrolls its long
    // lines itself, under its own horizontal scrollbar.
    code: "h-full",
    sheetHeader: "flex-row items-center justify-between gap-2",
  },
});

const { root, panel, footer, bleed, codeView, actions, code, sheetHeader } = demoTabs();

/** The two views a demo frame switches between. */
type DemoView = "demo" | "code";

/**
 * A demo's frame chrome: a flush Frame whose header names the demo, whose panel shows the Demo or
 * the Code view, and whose footer switches between them.
 *
 * The Tabs root holds the switch alone, and the views are tabpanels this component wires to its
 * tabs. Base UI's Tabs register their tabs and panels in layout effects, which changes the root's
 * context in the commit that hydrates the page. React can't see into a demo's Suspense boundary
 * before it hydrates, so a context change above that boundary throws the page's hydration render
 * away, hydrates that demo and renders the rest again, once per demo. With the stage outside the
 * Tabs, the page hydrates its demos in one pass. Both views stay mounted: the demo keeps
 * its state while the code shows, and the Code view, marked `[data-demo-source]`, puts the source
 * in the server HTML for the tools that read it, as plain text until the view first shows and its
 * highlighted markup arrives. Once it shows, the Code view carries a toolbar that copies the source
 * and opens it in a Sheet, where the same source shows in a flush Frame headed with the file name,
 * and scrolls the source in a scroll area. Mounting those on first show keeps a page of demos from
 * hydrating and measuring a toolbar, a Sheet and a scroll area per demo that nobody has opened.
 */
export function DemoTabs({
  title,
  heading,
  file,
  stage,
  sourceText,
  sourceHref,
}: DemoTabsProps): ReactElement {
  const demoView = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DemoView>("demo");
  const [demoHeight, setDemoHeight] = useState<number>();
  const id = useId();
  const tabId = (of: DemoView): string => `${id}-${of}-tab`;
  const panelId = (of: DemoView): string => `${id}-${of}`;
  // The highlighted source loads when the Code view first shows, and the Sheet opens from there.
  const [shown, setShown] = useState(false);
  const html = useHighlightedSource(sourceHref, shown);
  const source = <DocsCodePre variant="embedded" code={html === null ? { text: sourceText } : { html }} />;

  // Read while the Demo view still shows: the Code view then opens at the height it leaves.
  function rememberDemoHeight(): void {
    const height = demoView.current?.getBoundingClientRect().height;
    if (height !== undefined && height > 0) setDemoHeight(height);
  }

  return (
    <Frame.Root layout="flush" className={root()}>
      <Frame.Header>
        <Frame.Title>{heading}</Frame.Title>
      </Frame.Header>
      <Frame.Panel className={panel()}>
        <div className={bleed()}>
          {/* The views leave the tab order: the wrapper's clip would hide a focused view's ring,
              and a keyboard reaches the demo's own controls and the code's actions instead. */}
          <div
            ref={demoView}
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
                  <Sheet.Root>
                    <Toolbar.Button
                      render={
                        <Sheet.Trigger
                          render={<Button variant="ghost" size="icon-xs" aria-label="Open code" />}
                        />
                      }>
                      <ArrowsOut aria-hidden />
                    </Toolbar.Button>
                    <Sheet.Content size="4xl">
                      <Sheet.Header>
                        <Sheet.Title>{title}</Sheet.Title>
                      </Sheet.Header>
                      <Sheet.Body>
                        <Frame.Root layout="flush">
                          <Frame.Header className={sheetHeader()}>
                            <Frame.Title>{file}</Frame.Title>
                            <Toolbar.Root aria-label={`${file} actions`}>
                              <CopySourceButton
                                toolbar
                                sourceText={sourceText}
                                label="Copy code"
                                copiedStatus="Code copied to the clipboard"
                              />
                            </Toolbar.Root>
                          </Frame.Header>
                          <Frame.Panel>
                            <div className={bleed()}>{source}</div>
                          </Frame.Panel>
                        </Frame.Root>
                      </Sheet.Body>
                    </Sheet.Content>
                  </Sheet.Root>
                </Toolbar.Root>
                <ScrollArea.Root className={code()}>{source}</ScrollArea.Root>
              </>
            ) : (
              // Until the view first shows, it holds the plain source alone. The toolbar, the Sheet
              // and the scroll area, which measures itself as it mounts, wait for the reader.
              <div className={code()}>{source}</div>
            )}
          </div>
        </div>
      </Frame.Panel>
      <Frame.Footer className={footer()}>
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
