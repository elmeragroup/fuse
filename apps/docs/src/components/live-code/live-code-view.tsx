"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { applyEdits, sourceEdits } from "../../lib/live-code/edits";
import { findSites } from "../../lib/live-code/sites";
import type { LiveCodeStore } from "../../lib/live-code/store";
import { DocsCodePre } from "../docs-code-pre";
import { CopySourceButton } from "../source-code";
import { SourceSheet } from "../source-sheet";
import { editedMarkup } from "./edited-markup";
import { LiveCodeFrame } from "./live-code-frame";

type LiveCodeViewProps = {
  /** The frame's store, shared with its stage and its stage editor. */
  store: LiveCodeStore;
  /** The demo's title, which names the code toolbar and the Sheet. */
  title: string;
  /** The demo file name, shown in the toolbar. */
  file: string;
  /** The demo's source. */
  sourceText: string;
  /** The highlighted markup from `/demo-source`, or `null` while it loads. */
  html: string | null;
};

/**
 * A component demo's Code view: the demo's source beneath its stage, with the reader's committed
 * stage edits written in. Copy and "Open code" carry the same edited source, and Reset drops
 * every edit, which remounts the stage.
 *
 * The source shows the server's highlighted markup with the edits written into it at the
 * serializer's own offsets (`editedMarkup`), so the code a reader sees is the code Copy writes,
 * highlighted, without a highlighter on the client or a request per edit.
 */
export function LiveCodeView({ store, title, file, sourceText, html }: LiveCodeViewProps): ReactElement {
  const edits = useSyncExternalStore(store.subscribe, store.getEdits, store.getEdits);
  const sites = useMemo(() => findSites(sourceText), [sourceText]);
  const dirty = edits.size > 0;
  const replacements = useMemo(() => sourceEdits(sourceText, sites, edits), [sourceText, sites, edits]);
  const edited = applyEdits(sourceText, replacements);
  const markup = useMemo(
    () => (html === null || replacements.length === 0 ? html : editedMarkup(html, replacements)),
    [html, replacements]
  );
  const code = markup === null ? { text: edited } : { html: markup };

  return (
    <LiveCodeFrame
      title={title}
      file={file}
      actions={
        <>
          {dirty ? (
            <Toolbar.Button render={<Button variant="ghost" size="xs" />} onClick={() => store.reset()}>
              Reset
            </Toolbar.Button>
          ) : null}
          <CopySourceButton
            toolbar
            sourceText={edited}
            label="Copy code"
            copiedStatus="Code copied to the clipboard"
          />
          <SourceSheet title={title} file={file} sourceText={edited} code={code} />
        </>
      }
      source={<DocsCodePre variant="embedded" code={code} />}
    />
  );
}
