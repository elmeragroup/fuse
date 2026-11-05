import { createLogo } from "../create-logo";
import { TelinetLogoFull } from "./telinet-logo-full";
import { TelinetLogoMark } from "./telinet-logo-mark";

/**
 * The Telinet logo, the brand logo of the `fkse` themes. `variant="full"`, the default, draws the
 * dotted mark beside "Telinet Energi"; `variant="mark"` draws the dots alone. The dots and the word
 * "Telinet" keep the brand's cyan, as in the brand's own logo, and "Energi" paints in
 * `currentColor`. A nonempty `title` names the logo as an image; without one it renders decorative
 * and hidden from assistive technology.
 */
export const TelinetLogo = createLogo(TelinetLogoFull, TelinetLogoMark, "TelinetLogo");
