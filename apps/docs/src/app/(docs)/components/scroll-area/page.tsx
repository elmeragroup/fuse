import type { ReactElement } from "react";

import type { Metadata } from "next";

import { DemoFrame } from "../../../../components/DemoFrame";
import { ScrollAreaAlways } from "../../../../examples/scroll-area-always";
import { ScrollAreaHorizontal } from "../../../../examples/scroll-area-horizontal";
import { ScrollAreaVertical } from "../../../../examples/scroll-area-vertical";

export const metadata: Metadata = {
  title: "ScrollArea",
};

export default function ScrollAreaPage(): ReactElement {
  return (
    <>
      <h1>ScrollArea</h1>
      <p className="DocsLede">
        Styled custom scrollbars over native scrolling. <code>ScrollArea.Root</code> ships one bar for its
        orientation; the viewport stays a real scroll container.
      </p>
      <DemoFrame id="vertical" title="Vertical">
        <ScrollAreaVertical />
      </DemoFrame>
      <DemoFrame id="horizontal" title="Horizontal">
        <ScrollAreaHorizontal />
      </DemoFrame>
      <DemoFrame id="always-visible" title="Always visible">
        <ScrollAreaAlways />
      </DemoFrame>
    </>
  );
}
