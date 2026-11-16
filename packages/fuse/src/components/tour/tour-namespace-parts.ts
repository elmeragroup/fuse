/**
 * The parts of `Tour`, which `tour-namespace` re-exports as an ES module namespace. This module has
 * no directive, so a server component reads each part as a client reference. Each export name is the
 * part's key.
 */
export { TourProvider as Provider } from "./tour-provider";
export { TourTarget as Target } from "./tour-target";
export { TourBeacon as Beacon } from "./tour-beacon";
export { TourPopup as Popup } from "./tour-popup";
export {
  TourHeader as Header,
  TourProgress as Progress,
  TourClose as Close,
  TourSpotlight as Spotlight,
  TourRing as Ring,
  TourTitle as Title,
  TourDescription as Description,
  TourFooter as Footer,
  TourSkip as Skip,
  TourPrev as Prev,
  TourNext as Next,
} from "./tour-parts";
