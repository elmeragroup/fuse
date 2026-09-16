import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { readDemoSource } from "../lib/demo-source";
import { DemoStage } from "./demo-stage";
import { DocsCodeBlock } from "./docs-code-block";
import { DocsSectionHeading } from "./docs-section-heading";

export type DemoFrameProps = {
  /** Slug of the component page this demo belongs to; locates the `demos/` directory. */
  slug: string;
  /** Anchor id, unique inside the page; the on-page TOC links to it. */
  id: string;
  title: string;
  /** Demo file name inside the page's `demos/` directory — the file the page imports. */
  file: string;
  /** The rendered demo, imported by the page as an ordinary ESM module (§6). */
  children: ReactNode;
};

const demoFrame = tv({
  slots: {
    root: "mt-8",
    card: "overflow-hidden rounded-xl border border-border",
  },
});

const { root, card } = demoFrame();

/**
 * The §3.5 demo frame: a theme-tinted stage, the active theme coordinate and its
 * deployment-default density in mono, and the source of the very file that rendered the
 * stage.
 *
 * An async server component, so the source region comes from a read of the demo file
 * during prerendering rather than from generated data threaded through the page (§6).
 * Only the stage and meta row need the preview theme, and they are the client half
 * (`DemoStage`); the shell and the source region — highlighted by the shared
 * `DocsCodeBlock` from the same file the stage renders — stay on the server.
 */
export async function DemoFrame({ slug, id, title, file, children }: DemoFrameProps): Promise<ReactElement> {
  const demo = await readDemoSource(slug, file);

  return (
    <section className={root()} data-demo-frame aria-labelledby={id}>
      <DocsSectionHeading id={id}>{title}</DocsSectionHeading>
      <div className={card()}>
        <DemoStage sourcePath={demo.sourcePath}>{children}</DemoStage>
        <DocsCodeBlock variant="embedded" data-demo-source source={demo.source} />
      </div>
    </section>
  );
}
