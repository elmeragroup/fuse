import type { ReactElement } from "react";

import { StudioArtboard } from "../../../../studio/components/studio-artboard";
import { studioPageMetadata } from "../../../../studio/components/studio-metadata";
import { TypePairsBoard } from "../../../../studio/components/type/pairs-board";
import { SpecimenBoard } from "../../../../studio/components/type/specimen-board";
import { StacksBoard } from "../../../../studio/components/type/stacks-board";

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
