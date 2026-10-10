import type { ReactElement } from "react";

import { DensityOverlays } from "../../../../studio/components/density/density-overlays";
import { LadderBoard } from "../../../../studio/components/density/ladder-board";
import { TwinBoard } from "../../../../studio/components/density/twin-board";
import { StudioArtboard } from "../../../../studio/components/studio-artboard";
import { studioPageMetadata } from "../../../../studio/components/studio-metadata";
import { DENSITY_ARTBOARDS, DENSITY_TWINS } from "../../../../studio/lib/documents";

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
