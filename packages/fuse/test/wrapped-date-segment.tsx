import type { ReactElement } from "react";

import { DateInput } from "../src/components/date-field";
import type { DateInputSegmentData } from "../src/components/date-field/date-input-types";

/**
 * A `DateInput.Root` children callback that renders each segment inside a `<span>`, as a consumer
 * may wrap it. Pass it to `DateInput.Root` or a picker's input part.
 *
 * @param segment - The segment the Root passes.
 * @returns The wrapped segment.
 */
export function wrappedSegment(segment: DateInputSegmentData): ReactElement {
  return (
    <span key={segment.index}>
      <DateInput.Segment segment={segment} />
    </span>
  );
}

/**
 * Renders a segment with a custom `data-slot`, `booking-segment`, in place of the segment's own. Pass
 * it to `DateInput.Root` or a picker's input part as its children callback, or call it for one
 * segment.
 *
 * @param segment - The segment the Root passes.
 * @returns The segment with the custom `data-slot`.
 */
export function segmentWithCustomSlot(segment: DateInputSegmentData): ReactElement {
  return <DateInput.Segment key={segment.index} segment={segment} data-slot="booking-segment" />;
}
