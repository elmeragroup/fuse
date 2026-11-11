"use client";

import { useId, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

import { DocsCodePre } from "./docs-code-pre";
import { CopySourceButton, useHighlightedSource } from "./source-code";

/** One file of a block, as its Code view lists it. */
export type BlockFile = {
  /** The file name inside the block's `demos/`. */
  readonly file: string;
  /** The tree folder it sits under, such as "Shell", "Pages" or "Data". */
  readonly folder: string;
  /** The file's raw source, shown until its highlighted markup arrives, and what Copy copies. */
  readonly sourceText: string;
  /** The prerendered route that serves its highlighted markup. */
  readonly sourceHref: string;
};

const blockCode = tv({
  slots: {
    // The surface is a plain element of the docs', so no Fuse part's own look is restyled.
    root: "shadow-sm md:grid-cols-[13rem_minmax(0,1fr)] grid overflow-hidden rounded-xl bg-card ring-1 ring-border",
    // On a phone the tree sits above the code and scrolls in a short band of its own.
    tree: "max-md:max-h-44 max-md:border-b md:border-r overflow-y-auto border-border bg-muted/40 px-2 py-2",
    folder: "text-xs font-medium m-0 px-2 pt-3 pb-1 text-muted-foreground",
    list: "m-0 flex list-none flex-col gap-0.5 p-0",
    // Fuse Buttons, laid out as rows: only their width and alignment are set here.
    file: "w-full justify-start",
    fileName: "text-xs font-mono",
    pane: "flex min-h-0 min-w-0 flex-col",
    bar: "flex h-11 shrink-0 items-center gap-2 border-b border-border px-4",
    path: "text-xs min-w-0 flex-1 truncate font-mono text-muted-foreground",
    // The vertical scroll area holds the block to its width, so the block scrolls its long lines
    // itself, under its own horizontal scrollbar.
    code: "min-h-0 flex-1",
  },
});

const styles = blockCode();

function FileSource({ file, active }: { file: BlockFile; active: boolean }): ReactElement {
  const html = useHighlightedSource(file.sourceHref, active);
  return (
    <ScrollArea.Root className={styles.code()}>
      <DocsCodePre variant="embedded" code={html === null ? { text: file.sourceText } : { html }} />
    </ScrollArea.Root>
  );
}

type BlockCodeProps = {
  /** The block's folder, as the code bar names each file's path. */
  folder: string;
  /** Every file, in tree order. */
  files: readonly BlockFile[];
  /** Whether the Code view shows; the highlighted source loads only once it does. */
  active: boolean;
  /** The height the Code view keeps, the preview window's, so switching views moves nothing. */
  className?: string;
};

/**
 * A block's Code view: the file tree, and the selected file's source with a copy button. Each file
 * is a Fuse Button in its folder's list, the selected one marked `aria-current` and drawn in the
 * secondary variant, and only the selected file's highlighted markup is fetched.
 */
export function BlockCode({ folder, files, active, className }: BlockCodeProps): ReactElement {
  const [selected, setSelected] = useState(files[0]?.file ?? "");
  const folders = [...new Set(files.map((file) => file.folder))];
  const file = files.find((candidate) => candidate.file === selected) ?? files[0];
  const id = useId();
  return (
    <div className={styles.root({ className })}>
      <nav aria-label="Files" className={styles.tree()}>
        {folders.map((name) => (
          <div key={name}>
            <p id={`${id}-${name}`} className={styles.folder()}>
              {name}
            </p>
            <ul aria-labelledby={`${id}-${name}`} className={styles.list()}>
              {files
                .filter((candidate) => candidate.folder === name)
                .map((candidate) => {
                  const current = candidate.file === file?.file;
                  return (
                    <li key={candidate.file}>
                      <Button
                        variant={current ? "secondary" : "ghost"}
                        size="sm"
                        aria-current={current ? "true" : undefined}
                        className={styles.file()}
                        onClick={() => {
                          setSelected(candidate.file);
                        }}>
                        <span className={styles.fileName()}>{candidate.file}</span>
                      </Button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>
      {file === undefined ? null : (
        <section aria-label={`${file.file} source`} className={styles.pane()}>
          <div className={styles.bar()}>
            <p className={styles.path()}>
              {folder}/{file.file}
            </p>
            <CopySourceButton
              key={file.file}
              sourceText={file.sourceText}
              label={`Copy ${file.file}`}
              copiedStatus={`${file.file} copied to the clipboard`}
            />
          </div>
          <FileSource file={file} active={active} />
        </section>
      )}
    </div>
  );
}
