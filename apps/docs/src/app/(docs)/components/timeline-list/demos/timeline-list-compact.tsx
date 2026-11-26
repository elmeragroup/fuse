"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListCompact() {
  return (
    <TimelineList.Root spacing="compact">
      <TimelineList.Item>
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Contract signed</TimelineList.Title>
          <TimelineList.Time date="2026-01-08">8 January 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Supply started</TimelineList.Title>
          <TimelineList.Time date="2026-02-01">1 February 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Price changed</TimelineList.Title>
          <TimelineList.Time date="2026-03-01">1 March 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Contract renewed</TimelineList.Title>
          <TimelineList.Time date="2027-01-08">8 January 2027</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
