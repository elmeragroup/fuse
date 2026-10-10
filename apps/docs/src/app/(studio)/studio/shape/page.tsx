import type { ReactElement } from "react";

import { ConcentricLab } from "../../../../components/studio/shape/concentric-lab";
import { RungsBoard } from "../../../../components/studio/shape/rungs-board";
import { ShellsBoard } from "../../../../components/studio/shape/shells-board";
import { StudioArtboard } from "../../../../components/studio/studio-artboard";
import { studioPageMetadata } from "../../../../components/studio/studio-metadata";

export const metadata = studioPageMetadata("/studio/shape");

/**
 * The studio's Shape page: the radius rungs in each variant, Fuse's own shells and the
 * concentric explainer. The inspector leads with the Shape tokens here, and the corner X-ray
 * draws every inner corner's numbers over the canvas.
 */
export default function StudioCornersPage(): ReactElement {
  return (
    <>
      <StudioArtboard id="shape-rungs-internal">
        <RungsBoard variant="internal" />
      </StudioArtboard>
      <StudioArtboard id="shape-rungs-external">
        <RungsBoard variant="external" />
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
