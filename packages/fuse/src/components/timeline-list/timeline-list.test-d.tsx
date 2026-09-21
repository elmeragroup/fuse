import type { ComponentProps } from "react";

import { expectTypeOf, test } from "vitest";

import type { TimelineList as RootTimelineList } from "@elmeragroup/fuse";
import type {
  TimelineListDescriptionProps,
  TimelineListItemProps,
  TimelineListRootProps,
  TimelineListTimeProps,
  TimelineListTitleProps,
} from "@elmeragroup/fuse/timeline-list";
import * as TimelineListModule from "@elmeragroup/fuse/timeline-list";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";

test("the namespace ships all five parts from the timeline-list entry and the root barrel", () => {
  expectTypeOf<typeof TimelineList>().toEqualTypeOf<typeof RootTimelineList>();
  expectTypeOf(TimelineList).toHaveProperty("Root");
  expectTypeOf(TimelineList).toHaveProperty("Item");
  expectTypeOf(TimelineList).toHaveProperty("Title");
  expectTypeOf(TimelineList).toHaveProperty("Time");
  expectTypeOf(TimelineList).toHaveProperty("Description");
});

test("public API exports only the namespace and part prop types", () => {
  expectTypeOf<TimelineListRootProps>().toEqualTypeOf<ComponentProps<"ol">>();
  expectTypeOf<TimelineListItemProps>().toEqualTypeOf<ComponentProps<"li">>();
  expectTypeOf<TimelineListTitleProps>().not.toHaveProperty("noMargin");
  expectTypeOf<TimelineListTitleProps["level"]>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | undefined>();
  expectTypeOf<TimelineListDescriptionProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<TimelineListRootProps["ref"]>().toEqualTypeOf<ComponentProps<"ol">["ref"]>();
  expectTypeOf<TimelineListTimeProps["date"]>().toEqualTypeOf<string | Date>();
  expectTypeOf<TimelineListTimeProps>().not.toHaveProperty("dateTime");

  expectTypeOf(TimelineListModule).not.toHaveProperty("timelineListVariants");
  expectTypeOf(TimelineListModule).not.toHaveProperty("ListItemWithTimeline");
  expectTypeOf(TimelineListModule).not.toHaveProperty("ListItemWithTimelineTitle");
});

test("parts take native attributes and no polymorphic as prop", () => {
  const _root = (
    <TimelineList.Root className="max-w-md">
      <TimelineList.Item>
        <TimelineList.Title>Order placed</TimelineList.Title>
        <TimelineList.Time date="2024-03-03T10:00:00.000Z">3 March 2024</TimelineList.Time>
        <TimelineList.Time date={new Date("2024-03-03T10:00:00.000Z")}>3 March 2024</TimelineList.Time>
        <TimelineList.Title level={2}>Outline</TimelineList.Title>
        <TimelineList.Description>Confirmed at checkout.</TimelineList.Description>
      </TimelineList.Item>
    </TimelineList.Root>
  );

  // @ts-expect-error noMargin is forced and omitted from the public type
  const _noMargin = <TimelineList.Title noMargin={false}>Order placed</TimelineList.Title>;
  // @ts-expect-error date is required
  const _missingDate = <TimelineList.Time>3 March 2024</TimelineList.Time>;
  const _dateTime = (
    <TimelineList.Time
      date="2024-01-01T00:00:00.000Z"
      // @ts-expect-error dateTime is component-owned
      dateTime="nope">
      1 January
    </TimelineList.Time>
  );
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <TimelineList.Root as="ul" />;
});
