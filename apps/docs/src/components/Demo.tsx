import type { ReactElement, ReactNode } from "react";

import { requireDemo } from "../lib/component-page";
import { DemoFrame } from "./DemoFrame";

export type DemoProps = {
  /** Slug of the component page this demo belongs to. */
  slug: string;
  /** Anchor id, unique inside the page; the on-page TOC links to it. */
  id: string;
  title: string;
  /** Demo file name inside the page's `demos/` directory — the file the page imports. */
  file: string;
  /** The rendered demo, imported by the page as an ordinary ESM module (§6). */
  children: ReactNode;
};

/**
 * One §3.5 demo frame on an authored page: the page imports the demo and renders it as
 * this element's children, while the displayed source comes from the same file on disk.
 */
export function Demo({ slug, id, title, file, children }: DemoProps): ReactElement {
  const demo = requireDemo(slug, file);
  return (
    <DemoFrame id={id} title={title} highlighted={demo.highlighted} sourcePath={demo.sourcePath}>
      {children}
    </DemoFrame>
  );
}
