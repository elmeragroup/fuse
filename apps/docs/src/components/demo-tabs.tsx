"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Frame } from "@elmeragroup/fuse/frame";
import { ArrowsOut, Check, Copy } from "@elmeragroup/fuse/icons";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { copyText } from "../lib/copy-with-toast";
import { DocsCodePre } from "./docs-code-pre";

type DemoTabsProps = {
  /** The demo's title as plain text, for the Sheet title and the view switch's name. */
  title: string;
  /** The heading that names the frame, rendered inside `Frame.Title`. */
  heading: ReactNode;
  /** The demo file name, the header of the Sheet's code frame. */
  file: string;
  /** The theme-tinted stage with the demo in it. */
  stage: ReactNode;
  /** The demo file's raw source, which the copy action writes to the clipboard. */
  sourceText: string;
  /** The server's highlighted markup of the source, which the Code view and the Sheet both show. */
  sourceHtml: string;
};

/** How long the copy action shows that it copied, in ms. */
const COPIED_MS = 2000;

const demoTabs = tv({
  slots: {
    // The Tabs root renders the Frame root, and its `gap-2` would open gaps between the
    // Frame's header, panel and footer. The root and the panel give up the `relative` the Frame
    // gives them, so no ancestor of the stage is positioned and the popups a demo portals into
    // its stage take the document as their containing block, as on a page without the frame.
    // A positioned ancestor moves them: Base UI scrolls a Combobox's selected item into view on
    // the frame after it opens, before it places the popup against its real containing block,
    // so the item sits that ancestor's offset too low and the page scrolls to it.
    root: "static gap-0",
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
    code: "h-full",
    // The scroll area's content grows to the width of what it holds, so code as wide as its
    // longest line would never overflow the code block, and the scroll area draws only a vertical
    // bar. Containing the block's inline size keeps it to the scroll area's width, so the block
    // scrolls its long lines itself, under its own horizontal scrollbar.
    codeSource: "[contain:inline-size]",
    sheetHeader: "flex-row items-center justify-between gap-2",
    status: "sr-only",
  },
});

const {
  root,
  panel,
  footer,
  bleed,
  codeView,
  actions,
  code,
  codeSource,
  sheetHeader,
  status: statusClass,
} = demoTabs();

/**
 * The demo's source as `DocsCodeBlock` draws it. The page's HTML holds the plain text, which the
 * tools that read the source find, and the highlighted markup replaces it once a reader shows the
 * code. A page of demos then parses one text node per demo instead of a span per token: the 36
 * highlighted sources of the bar-chart page held 40,000 of its 46,700 nodes, and WebKit took 4 s
 * to parse them beside the RSC payload.
 */
function DemoSource({ text, html }: { text: string; html: string | null }): ReactElement {
  return <DocsCodePre variant="embedded" code={html === null ? { text } : { html }} />;
}

/** What the last copy did: nothing yet, copied, or failed because the page has no clipboard. */
type CopyState = "idle" | "copied" | "failed";

/** What the live region says after each copy. */
const COPY_STATUS = {
  idle: "",
  copied: "Code copied to the clipboard",
  failed: "Could not copy the code",
} as const satisfies Record<CopyState, string>;

/**
 * Copies a demo's source to the clipboard. The button turns into a check and says "Copied" while
 * the copy shows, and a polite live region tells a screen reader that the copy happened, or that
 * it could not, as where the page has no clipboard.
 */
function CopySourceButton({ sourceText }: { sourceText: string }): ReactElement {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy(): Promise<void> {
    setState((await copyText(sourceText)) ? "copied" : "failed");
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState("idle"), COPIED_MS);
  }

  return (
    <>
      <Toolbar.Button
        onClick={() => void copy()}
        render={
          <Button variant="ghost" size="icon-xs" aria-label={state === "copied" ? "Copied" : "Copy code"} />
        }>
        {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Toolbar.Button>
      <span role="status" className={statusClass()}>
        {COPY_STATUS[state]}
      </span>
    </>
  );
}

/**
 * A demo's frame chrome: a flush Frame whose header names the demo, whose panel shows the Demo or
 * the Code view, and whose footer switches between them. The Tabs root renders the Frame root, so
 * the header, panel and footer stay the Frame's own items. Both views stay mounted: the demo keeps
 * its state while the code shows, and the Code view, marked `[data-demo-source]`, puts the source
 * in the server HTML for the tools that read it, as plain text until the view first shows. The Code view carries a toolbar that copies the
 * source and opens it in a Sheet, where the same source shows in a flush Frame headed with the file
 * name.
 */
export function DemoTabs({
  title,
  heading,
  file,
  stage,
  sourceText,
  sourceHtml,
}: DemoTabsProps): ReactElement {
  const demoView = useRef<HTMLDivElement>(null);
  const [demoHeight, setDemoHeight] = useState<number>();
  // The highlighted source mounts when the Code view first shows, and the Sheet opens from there.
  const [shown, setShown] = useState(false);
  const source = <DemoSource text={sourceText} html={shown ? sourceHtml : null} />;

  // Read while the Demo view still shows: the Code view then opens at the height it leaves.
  function rememberDemoHeight(): void {
    const height = demoView.current?.getBoundingClientRect().height;
    if (height !== undefined && height > 0) setDemoHeight(height);
  }

  return (
    <Tabs.Root
      defaultValue="demo"
      onValueChange={(value) => {
        if (value !== "code") return;
        rememberDemoHeight();
        setShown(true);
      }}
      className={root()}
      render={<Frame.Root layout="flush" />}>
      <Frame.Header>
        <Frame.Title>{heading}</Frame.Title>
      </Frame.Header>
      <Frame.Panel className={panel()}>
        <div className={bleed()}>
          {/* The views leave the tab order: the wrapper's clip would hide a focused view's ring,
              and a keyboard reaches the demo's own controls and the code's actions instead. */}
          <Tabs.Content ref={demoView} value="demo" keepMounted tabIndex={-1}>
            {stage}
          </Tabs.Content>
          <Tabs.Content
            value="code"
            keepMounted
            tabIndex={-1}
            data-demo-source
            className={codeView()}
            style={{ "--demo-height": demoHeight === undefined ? undefined : `${demoHeight}px` }}>
            <Toolbar.Root aria-label={`${title} code`} className={actions()}>
              <CopySourceButton sourceText={sourceText} />
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
                          <CopySourceButton sourceText={sourceText} />
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
            <ScrollArea.Root className={code()}>
              <div className={codeSource()}>{source}</div>
            </ScrollArea.Root>
          </Tabs.Content>
        </div>
      </Frame.Panel>
      <Frame.Footer className={footer()}>
        <Tabs.List aria-label={`${title} view`}>
          <Tabs.Trigger value="demo">Demo</Tabs.Trigger>
          <Tabs.Trigger value="code">Code</Tabs.Trigger>
        </Tabs.List>
      </Frame.Footer>
    </Tabs.Root>
  );
}
