import type { ReactElement } from "react";

import { ConcentricLab } from "../../../../studio/components/shape/concentric-lab";
import { RungsBoard } from "../../../../studio/components/shape/rungs-board";
import { ShellsBoard } from "../../../../studio/components/shape/shells-board";
import { StudioArtboard } from "../../../../studio/components/studio-artboard";
import { studioPageMetadata } from "../../../../studio/components/studio-metadata";

export const metadata = studioPageMetadata("/studio/shape");

/**
 * The studio's Shape page: the radius rungs in each identity, Fuse's own shells and the
 * concentric explainer. The inspector leads with the Shape tokens here, and the corner X-ray
 * draws every inner corner's numbers over the canvas.
 */
export default function StudioCornersPage(): ReactElement {
  return (
    <>
      <StudioArtboard id="shape-rungs-neutral">
        <RungsBoard identity="neutral" />
      </StudioArtboard>
      <StudioArtboard id="shape-rungs-branded">
        <RungsBoard identity="branded" />
      </StudioArtboard>
      <StudioArtboard id="shape-shells">
        <ShellsBoard />
      </StudioArtboard>
      <StudioArtboard id="shape-concentric-lab">
        <ConcentricLab />
      </StudioArtboard>
    </>
  );
}
