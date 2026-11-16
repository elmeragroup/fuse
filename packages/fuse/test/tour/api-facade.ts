/**
 * The tour entry as the docs API extractor reads it. The extractor in `@elmeragroup/internal`
 * cannot model the type of an ES module namespace, which is how `src/tour.ts` exports `Tour`, so the
 * tour page extracts from this plain object instead. It holds the same part components under the
 * same keys as the namespace, in the order the page lists them, which `tour-api-facade.test.ts`
 * checks. The hooks the page documents pass through.
 */
import { TourBeacon } from "../../src/components/tour/tour-beacon";
import {
  TourClose,
  TourDescription,
  TourFooter,
  TourHeader,
  TourNext,
  TourPrev,
  TourProgress,
  TourRing,
  TourSkip,
  TourSpotlight,
  TourTitle,
} from "../../src/components/tour/tour-parts";
import { TourPopup } from "../../src/components/tour/tour-popup";
import { TourProvider } from "../../src/components/tour/tour-provider";
import { TourTarget } from "../../src/components/tour/tour-target";

export {
  useAutoStartTour,
  useTour,
  useTourStep,
  useTourStepDone,
} from "../../src/components/tour/tour-provider";

/** `Tour`'s parts as a plain object, for the docs API extractor. */
export const Tour = {
  Provider: TourProvider,
  Target: TourTarget,
  Beacon: TourBeacon,
  Popup: TourPopup,
  Header: TourHeader,
  Progress: TourProgress,
  Close: TourClose,
  Spotlight: TourSpotlight,
  Ring: TourRing,
  Title: TourTitle,
  Description: TourDescription,
  Footer: TourFooter,
  Skip: TourSkip,
  Prev: TourPrev,
  Next: TourNext,
};
