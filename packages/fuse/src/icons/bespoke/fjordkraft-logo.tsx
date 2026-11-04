import { createLogo } from "../create-logo";
import { FjordkraftLogoFull } from "./fjordkraft-logo-full";
import { FjordkraftLogoMark } from "./fjordkraft-logo-mark";

/**
 * The Fjordkraft logo, the brand logo of the `fkas` and `fkab` themes. `variant="full"`, the
 * default, draws the face beside the wordmark; `variant="mark"` draws the face alone. Both paint
 * in `currentColor`, so on a brand-colored tile set the text color to the brand foreground too. A
 * nonempty `title` names the logo as an image; without one it renders decorative and hidden from
 * assistive technology.
 */
export const FjordkraftLogo = createLogo(FjordkraftLogoFull, FjordkraftLogoMark, "FjordkraftLogo");
