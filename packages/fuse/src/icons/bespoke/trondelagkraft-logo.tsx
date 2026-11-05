import { createLogo } from "../create-logo";
import { TrondelagkraftLogoFull } from "./trondelagkraft-logo-full";
import { TrondelagkraftLogoMark } from "./trondelagkraft-logo-mark";

/**
 * The TrøndelagKraft logo, the brand logo of the `tkas` themes. `variant="full"`, the default,
 * draws the lamp beside the wordmark; `variant="mark"` draws the lamp alone. The lettering and the
 * lamp's ring and base paint in `currentColor`, and the lamp's light keeps the brand yellow, so on
 * a brand-colored tile set the text color to the brand foreground too. To give the ring and base
 * an ink apart from the lettering, set the `--logo-mark-ink` custom property on the logo or an
 * ancestor: TrøndelagKraft's brand color draws its turquoise lamp beside a text-colored name. A
 * nonempty `title` names the logo as an image; without one it renders decorative and hidden from
 * assistive technology.
 */
export const TrondelagkraftLogo = createLogo(
  TrondelagkraftLogoFull,
  TrondelagkraftLogoMark,
  "TrondelagkraftLogo"
);
