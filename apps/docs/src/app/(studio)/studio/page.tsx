import type { ReactElement } from "react";

import { ComponentsBoard } from "../../../studio/components/overview/components-board";
import { GlanceBoard } from "../../../studio/components/overview/glance-board";
import { StudioArtboard } from "../../../studio/components/studio-artboard";
import { studioPageMetadata } from "../../../studio/components/studio-metadata";
import { OVERVIEW_ARTBOARDS } from "../../../studio/lib/documents";

const HREF = "/studio";

export const metadata = studioPageMetadata(HREF);

const GLANCE_ID = "theme-at-a-glance";

/** The studio's Overview: the components in four scheme × density pairs, and the theme at a glance. */
export default function StudioOverviewPage(): ReactElement {
  return (
    <>
      {OVERVIEW_ARTBOARDS.map((artboard) => (
        <StudioArtboard key={artboard.id} id={artboard.id}>
          {artboard.id === GLANCE_ID ? <GlanceBoard /> : <ComponentsBoard />}
        </StudioArtboard>
      ))}
    </>
  );
}
