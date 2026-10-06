import { createLogo } from "../create-logo";
import { NordicGreenEnergyLogoFull } from "./nordic-green-energy-logo-full";
import { NordicGreenEnergyLogoMark } from "./nordic-green-energy-logo-mark";

/**
 * The Nordic Green Energy logo, the brand logo of the `ngfi` themes. `variant="full"`, the
 * default, draws the leaf mark beside the wordmark; `variant="mark"` draws the leaf mark alone.
 * Both keep the brand's fixed colors. A nonempty `title` names the logo as an image; without one
 * it renders decorative and hidden from assistive technology.
 */
export const NordicGreenEnergyLogo = createLogo(
  NordicGreenEnergyLogoFull,
  NordicGreenEnergyLogoMark,
  "NordicGreenEnergyLogo"
);
