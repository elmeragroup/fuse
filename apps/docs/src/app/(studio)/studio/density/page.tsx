import type { ReactElement } from "react";

import { DensityOverlays } from "../../../../components/studio/density/density-overlays";
import { LadderBoard } from "../../../../components/studio/density/ladder-board";
import { TwinBoard } from "../../../../components/studio/density/twin-board";
import { StudioArtboard } from "../../../../components/studio/studio-artboard";
import { studioPageMetadata } from "../../../../components/studio/studio-metadata";
import { DENSITY_ARTBOARDS, DENSITY_TWINS } from "../../../../lib/studio/documents";

const HREF = "/studio/density";

export const metadata = studioPageMetadata(HREF);

/**
 * The studio's Density page: one composition dense and comfortable side by side, the control size
 * ladder at both densities, and the measure and role X-ray overlays over them.
 */
export default function StudioDensityPage(): ReactElement {
  return (
    <>
      {DENSITY_ARTBOARDS.map((artboard) => (
        <StudioArtboard key={artboard.id} id={artboard.id}>
          {DENSITY_TWINS.some((id) => id === artboard.id) ? <TwinBoard /> : <LadderBoard />}
        </StudioArtboard>
      ))}
      <DensityOverlays />
    </>
  );
}
