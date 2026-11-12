import { Suspense } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { requireComponent } from "../lib/component-page";
import { demoSourceHref, readDemoSource } from "../lib/demo-source";
import type { DemoLocation } from "../lib/demo-source";
import type { DocsRouteSection } from "../lib/docs-route-files";
import { DemoHydrationMarker } from "./demo-hydration-marker";
import { DemoStage } from "./demo-stage";
import { DemoTabs } from "./demo-tabs";
import { LiveCodeBoundary } from "./live-code/live-code-boundary";
import { RetryBoundary } from "./retry-boundary";

type DemoFrameProps = {
  /** Docs section of the page this demo belongs to. Component pages, the MDX default, omit it. */
  section?: DocsRouteSection;
  /** Slug of the page this demo belongs to inside its section; locates the `demos/` directory. */
  slug: string;
  /** Anchor id, unique inside the page; the on-page TOC links to it. */
  id: string;
  title: string;
  /**
   * The level of the demo's heading. A component page's examples sit under its `## Examples`
   * heading at level 3, which the page writes as `level={3}`; the TOC nests them there.
   */
  level?: 2 | 3;
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
    hidden: "sr-only",
  },
});

const { root, heading, hidden } = demoFrame();

/**
 * The demo frame: a flush Frame titled with the demo, with a Demo view, the theme-tinted stage,
 * and a Code view, the source of the very file that rendered the stage, with actions that copy
 * it and open it in a Sheet. The footer switches between the views.
 *
 * A server component, so the source comes from a read of the demo file during prerendering rather
 * than from generated data threaded through the page. The page carries it as plain text. The
 * docs' one highlighter marks it up in the prerendered `/demo-source` route, which the client
 * `DemoTabs` fetches the first time its Code view shows. `DemoTabs` holds the view switch and the
 * Sheet, and only the stage follows the preview theme (`DemoStage`). The heading keeps its level
 * and id inside `Frame.Title`, so the TOC and screen readers find the demo as before.
 *
 * A demo that reads the clock while it renders cannot prerender, such as one that builds today's
 * date. The boundary keeps such a demo out of the static HTML, and
 * the browser renders it on hydration; every other demo prerenders as before. The marker inside
 * the boundary stamps `data-demo-hydrated` on the frame once the demo is live. A demo that fails
 * to render shows a reload prompt in its stage, and the page around it keeps working.
 */
export function DemoFrame({
  section = "components",
  slug,
  id,
  title,
  level = 2,
  file,
  children,
}: DemoFrameProps): ReactElement {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <section className={root()} data-demo-frame aria-labelledby={id}>
      <DemoFrameTabs
        location={{ section, slug, file }}
        title={title}
        labelId={id}
        heading={
          <Heading id={id} className={heading()}>
            {title}
          </Heading>
        }>
        {children}
      </DemoFrameTabs>
    </section>
  );
}

type DemoFrameTabsProps = {
  location: DemoLocation;
  title: string;
  /** The id of the element that names the frame, which the hydration marker finds it by. */
  labelId: string;
  heading?: ReactNode;
  children: ReactNode;
};

/** The tabs, stage and source of one frame: a component demo's Code view is Live code. */
function DemoFrameTabs({ location, title, labelId, heading, children }: DemoFrameTabsProps): ReactElement {
  const demo = readDemoSource(location);
  return (
    <DemoTabs
      title={title}
      heading={heading}
      liveCode={location.section === "components"}
      file={location.file}
      stage={
        <DemoStage>
          <RetryBoundary subject="This demo">
            <LiveCodeBoundary>
              <Suspense fallback={null}>
                {children}
                <DemoHydrationMarker headingId={labelId} />
              </Suspense>
            </LiveCodeBoundary>
          </RetryBoundary>
        </DemoStage>
      }
      sourceText={demo.source}
      sourceHref={demoSourceHref(location)}
    />
  );
}

type DefaultDemoProps = {
  /** Slug of the component page; locates the `demos/` directory and names the stage. */
  slug: string;
  /** Demo file name inside the page's `demos/` directory. */
  file: string;
  /** The rendered demo: one plain instance of the page's component. */
  children: ReactNode;
};

/** The id of the default stage's label. A page has one default stage, so the id is fixed. */
const DEFAULT_DEMO_LABEL = "default-demo";

/**
 * A component page's default stage, right under its intro. It is one frame with the component in
 * its plainest form, and its Code view. It has no heading and no TOC entry, so a visually hidden
 * label names it, such as "Button demo".
 */
export function DefaultDemo({ slug, file, children }: DefaultDemoProps): ReactElement {
  const { title } = requireComponent(slug);
  const label = `${title} demo`;
  return (
    <section className={root()} data-demo-frame aria-labelledby={DEFAULT_DEMO_LABEL}>
      <span id={DEFAULT_DEMO_LABEL} className={hidden()}>
        {label}
      </span>
      <DemoFrameTabs
        location={{ section: "components", slug, file }}
        title={label}
        labelId={DEFAULT_DEMO_LABEL}>
        {children}
      </DemoFrameTabs>
    </section>
  );
}
