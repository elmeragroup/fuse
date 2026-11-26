"use client";

import { TimelineList } from "@elmeragroup/fuse/timeline-list";

export function TimelineListStatus() {
  return (
    <TimelineList.Root>
      <TimelineList.Item status="complete">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Order placed</TimelineList.Title>
          <TimelineList.Time date="2026-03-03">3 March 2026</TimelineList.Time>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item status="error">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Meter reading failed</TimelineList.Title>
          <TimelineList.Description>The meter did not answer the remote read.</TimelineList.Description>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item status="current">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Reading requested again</TimelineList.Title>
          <TimelineList.Description>The grid company retries within a day.</TimelineList.Description>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item status="upcoming">
        <TimelineList.Indicator />
        <TimelineList.Content>
          <TimelineList.Title>Invoice issued</TimelineList.Title>
          <TimelineList.Description>After the reading arrives.</TimelineList.Description>
        </TimelineList.Content>
      </TimelineList.Item>
    </TimelineList.Root>
  );
}
