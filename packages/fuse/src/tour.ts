/**
 * Fuse tours: a sequence of popups that point at parts of a page. Preview: names and props can
 * change until Fuse's first stable release.
 *
 * Every later tour change follows the growth rule. A new capability becomes a new part, a hook, a
 * definition field or a Provider prop. It never becomes a boolean or mode prop on a part.
 *
 * Unlike other Fuse parts, a tour never throws into the page. A part or hook outside
 * `Tour.Provider` renders no tour and warns once in development. The Provider reports each error
 * it catches to `onError`. A failed storage read or write moves the tour's records to memory, and
 * the run goes on. An `onEvent` callback that throws also leaves the run going. Only a part that
 * throws, or a failure inside the tour itself, ends the run as `error`.
 *
 * @packageDocumentation
 */
// This is the source entry facade for `@elmeragroup/fuse/tour`. It holds explicit named re-exports
// and no `export *`, local declaration or directive. The exports and barrel generators discover
// this file. It stays out of the root barrel while it carries the preview label.
export { Tour } from "./components/tour/tour-namespace";
export { useTour, useTourStep, useAutoStartTour } from "./components/tour/tour-provider";
export { defineTour, tourStepKey } from "./components/tour/tour-definition";
export {
  TOUR_COOKIE_NAME,
  mergeTourRecords,
  parseTourCookie,
  parseTourRecords,
  serializeTourCookie,
} from "./components/tour/tour-records";
export {
  TOUR_STORAGE_KEY,
  layeredTourStorage,
  localTourStorage,
  memoryTourStorage,
  remoteTourStorage,
} from "./components/tour/tour-storage";
export { TOUR_STEP_ATTRIBUTE } from "./components/tour/tour-target-dom";
export { TourError } from "./components/tour/tour-error";
export type {
  TourDefinition,
  TourDefinitionInput,
  TourDefinitionStep,
  TourStepPlacement,
} from "./components/tour/tour-definition";
export type { TourRecord, TourRecords, TourStatus } from "./components/tour/tour-records";
export type {
  TourEndReason,
  TourOrigin,
  TourRecordChange,
  TourStartRefusal,
  TourState,
} from "./components/tour/tour-session";
export type {
  LayeredTourStorageOptions,
  LocalTourStorageOptions,
  RemoteTourStorageOptions,
  TourStorage,
} from "./components/tour/tour-storage";
export type {
  TourEvent,
  TourStartResult,
  TourStepWords,
  TourStorageOperation,
} from "./components/tour/tour-controller";
export type { TourErrorSource } from "./components/tour/tour-error";
export type {
  AutoStartTourOptions,
  TourHandle,
  TourProviderProps,
  TourStepBinding,
} from "./components/tour/tour-provider";
export type { TourTargetProps } from "./components/tour/tour-target";
export type { TourPopupProps } from "./components/tour/tour-popup";
export type { TourCloseProps, TourStepButtonProps } from "./components/tour/tour-parts";
