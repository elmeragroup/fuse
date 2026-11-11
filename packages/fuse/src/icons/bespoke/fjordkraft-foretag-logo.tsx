import { createLogo } from "../create-logo";
import { FjordkraftForetagLogoFull } from "./fjordkraft-foretag-logo-full";
import { FjordkraftLogoMark } from "./fjordkraft-logo-mark";

/**
 * The Fjordkraft Företag logo, the brand logo of the `fkab` themes. `variant="full"`, the default,
 * draws the Fjordkraft face beside "Fjordkraft Företag"; `variant="mark"` draws the face alone, the
 * same mark as `FjordkraftLogo`'s. Both paint in `currentColor`, so on a brand-colored tile set the
 * text color to the brand foreground too. A nonempty `title` names the logo as an image; without
 * one it renders decorative and hidden from assistive technology.
 */
export const FjordkraftForetagLogo = createLogo(
  FjordkraftForetagLogoFull,
  FjordkraftLogoMark,
  "FjordkraftForetagLogo"
);
