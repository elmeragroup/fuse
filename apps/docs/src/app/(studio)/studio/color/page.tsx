import type { ReactElement, ReactNode } from "react";

import { ChartsBoard } from "../../../../components/studio/color/charts-board";
import { PairsBoard } from "../../../../components/studio/color/pairs-board";
import { PrimitivesBoard } from "../../../../components/studio/color/primitives-board";
import { SidebarBoard } from "../../../../components/studio/color/sidebar-board";
import { StatusBoard } from "../../../../components/studio/color/status-board";
import { SyntaxBoard } from "../../../../components/studio/color/syntax-board";
import { StudioArtboard } from "../../../../components/studio/studio-artboard";
import { studioPageMetadata } from "../../../../components/studio/studio-metadata";

export const metadata = studioPageMetadata("/studio/color");

const SCHEMES = ["light", "dark"] as const;

/** A board on its light artboard and its dark twin, `${id}-light` and `${id}-dark`. */
function SchemePair({ id, children }: { id: string; children: ReactNode }): ReactElement {
  return (
    <>
      {SCHEMES.map((scheme) => (
        <StudioArtboard key={scheme} id={`${id}-${scheme}`}>
          {children}
        </StudioArtboard>
      ))}
    </>
  );
}

/**
 * The studio's Color page: the role pairs and status roles with live contrast, the chart,
 * sidebar and syntax colors, each in light and dark side by side, and the primitives. The
 * inspector leads with the color sections, and a pair's click opens its knob there.
 */
export default function StudioColorPage(): ReactElement {
  return (
    <>
      <SchemePair id="color-pairs">
        <PairsBoard />
      </SchemePair>
      <SchemePair id="color-status">
        <StatusBoard />
      </SchemePair>
      <StudioArtboard id="color-primitives">
        <PrimitivesBoard />
      </StudioArtboard>
      <SchemePair id="color-charts">
        <ChartsBoard />
      </SchemePair>
      <SchemePair id="color-sidebar">
        <SidebarBoard />
      </SchemePair>
      <SchemePair id="color-syntax">
        {/* Highlighted here, on the server: the highlighter stays out of the client graph. */}
        <SyntaxBoard />
      </SchemePair>
    </>
  );
}
