import { Suspense } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { readDemoSource } from "../lib/demo-source";
import type { DocsRouteSection } from "../lib/docs-route-files";
import { DemoHydrationMarker } from "./demo-hydration-marker";
import { DemoStage } from "./demo-stage";
import { DemoTabs } from "./demo-tabs";
import { DocsCodeBlock } from "./docs-code-block";
import { RetryBoundary } from "./retry-boundary";

type DemoFrameProps = {
  /** Docs section of the page this demo belongs to. Component pages, the MDX default, omit it. */
  section?: DocsRouteSection;
  /** Slug of the page this demo belongs to inside its section; locates the `demos/` directory. */
  slug: string;
  /** Anchor id, unique inside the page; the on-page TOC links to it. */
  id: string;
  title: string;
  /** Demo file name inside the page's `demos/` directory — the file the page imports. */
  file: string;
  /** The rendered demo, imported by the page as an ordinary ESM module. */
  children: ReactNode;
};

const demoFrame = tv({
  slots: {
    root: "mt-10",
    // The heading keeps the anchor id the on-page TOC links to, and lands below the sticky docs
    // header with the frame's top edge in view.
    heading: "scroll-mt-[calc(var(--spacing-docs-header)_+_1.5rem)]",
  },
});

const { root, heading } = demoFrame();

/**
 * The demo frame: a flush Frame titled with the demo, with a Demo view, the theme-tinted stage,
 * and a Code view, the source of the very file that rendered the stage, with actions that copy
 * it and open it in a Sheet. The footer switches between the views.
 *
 * A server component, so the source comes from a read of the demo file during prerendering rather
 * than from generated data threaded through the page, highlighted here by the shared
 * `DocsCodeBlock`. The chrome that holds state, the view switch and the Sheet, is the client
 * `DemoTabs`, and only the stage follows the preview theme (`DemoStage`). The heading keeps its level and id inside `Frame.Title`, so the TOC and screen
 * readers find the demo as before.
 *
 * A demo that reads the clock while it renders cannot prerender: React Aria's date components
 * build their dates on `new Date()`. The boundary keeps such a demo out of the static HTML, and
 * the browser renders it on hydration; every other demo prerenders as before. The marker inside
 * the boundary stamps `data-demo-hydrated` on the frame once the demo is live. A demo that fails
 * to render shows a reload prompt in its stage, and the page around it keeps working.
 */
export function DemoFrame({
  section = "components",
  slug,
  id,
  title,
  file,
  children,
}: DemoFrameProps): ReactElement {
  const demo = readDemoSource({ section, slug, file });

  return (
    <section className={root()} data-demo-frame aria-labelledby={id}>
      <DemoTabs
        title={title}
        heading={
          <h2 id={id} className={heading()}>
            {title}
          </h2>
        }
        file={file}
        stage={
          <DemoStage>
            <RetryBoundary subject="This demo">
              <Suspense fallback={null}>
                {children}
                <DemoHydrationMarker headingId={id} />
              </Suspense>
            </RetryBoundary>
          </DemoStage>
        }
        sourceText={demo.source}
        source={<DocsCodeBlock variant="embedded" data-demo-source source={demo.source} />}
        sheetSource={<DocsCodeBlock variant="embedded" source={demo.source} />}
      />
    </section>
  );
}
