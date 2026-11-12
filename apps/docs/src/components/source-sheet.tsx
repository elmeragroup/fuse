"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Frame } from "@elmeragroup/fuse/frame";
import { ArrowsOut } from "@elmeragroup/fuse/icons";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { DocsCodePre } from "./docs-code-pre";
import type { DocsCodeContent } from "./docs-code-pre";
import { CopySourceButton } from "./source-code";

const sourceSheet = tv({
  slots: {
    header: "flex-row items-center justify-between gap-2",
    // The panel's padding belongs to the code block, which carries its own.
    bleed: "-m-(--surface-pad-lg) overflow-hidden rounded-[inherit]",
  },
});

const { header, bleed } = sourceSheet();

type SourceSheetProps = {
  /** The demo's title, the Sheet's title. */
  title: string;
  /** The demo file name, the header of the Sheet's code frame. */
  file: string;
  /** The source the Sheet shows and its Copy button writes. */
  sourceText: string;
  /** What the Sheet's code block shows: the source as text, or its highlighted markup. */
  code: DocsCodeContent;
};

/**
 * A demo Code view's "Open code" action: a toolbar button that opens the source whole in a wide
 * Sheet, in a flush Frame headed with the file name and a Copy button. It is an item of the Code
 * view's toolbar, so it renders inside a `Toolbar.Root`.
 */
export function SourceSheet({ title, file, sourceText, code }: SourceSheetProps): ReactElement {
  return (
    <Sheet.Root>
      <Toolbar.Button
        render={<Sheet.Trigger render={<Button variant="ghost" size="icon-xs" aria-label="Open code" />} />}>
        <ArrowsOut aria-hidden />
      </Toolbar.Button>
      <Sheet.Content size="4xl">
        <Sheet.Header>
          <Sheet.Title>{title}</Sheet.Title>
        </Sheet.Header>
        <Sheet.Body>
          <Frame.Root layout="flush">
            <Frame.Header className={header()}>
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
              <div className={bleed()}>
                <DocsCodePre variant="embedded" code={code} />
              </div>
            </Frame.Panel>
          </Frame.Root>
        </Sheet.Body>
      </Sheet.Content>
    </Sheet.Root>
  );
}
