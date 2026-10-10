import type { ReactElement } from "react";

import { StudioArtboard } from "../../../../components/studio/studio-artboard";
import { studioPageMetadata } from "../../../../components/studio/studio-metadata";
import { TypePairsBoard } from "../../../../components/studio/type/pairs-board";
import { SpecimenBoard } from "../../../../components/studio/type/specimen-board";
import { StacksBoard } from "../../../../components/studio/type/stacks-board";

export const metadata = studioPageMetadata("/studio/type");

/**
 * The studio's Type page: the specimen in the theme's two font stacks, the control and label
 * type pairs dense against comfortable, and a line in every stack the font knobs offer. The
 * inspector leads with the Typography tokens here.
 */
export default function StudioTypePage(): ReactElement {
  return (
    <>
      <StudioArtboard id="type-specimen">
        <SpecimenBoard />
      </StudioArtboard>
      <StudioArtboard id="type-pairs-dense">
        <TypePairsBoard />
      </StudioArtboard>
      <StudioArtboard id="type-pairs-comfortable">
        <TypePairsBoard />
      </StudioArtboard>
      <StudioArtboard id="type-stacks">
        <StacksBoard />
      </StudioArtboard>
    </>
  );
}
