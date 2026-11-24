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
