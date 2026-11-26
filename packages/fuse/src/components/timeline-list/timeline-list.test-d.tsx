import type { ComponentProps, ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type {
  TimelineListContentProps,
  TimelineListDescriptionProps,
  TimelineListIndicatorProps,
  TimelineListItemProps,
  TimelineListMarkProps,
  TimelineListOppositeProps,
  TimelineListRootProps,
  TimelineListTimeProps,
  TimelineListTitleProps,
} from "@elmeragroup/fuse/timeline-list";
import * as TimelineListModule from "@elmeragroup/fuse/timeline-list";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";

test("public API exports only the namespace and part prop types", () => {
  // Each part takes its element's props and adds only optional ones.
  expectTypeOf<TimelineListRootProps>().toExtend<ComponentProps<"ol">>();
  expectTypeOf<ComponentProps<"ol">>().toExtend<TimelineListRootProps>();
  expectTypeOf<TimelineListRootProps["layout"]>().toEqualTypeOf<
    "vertical" | "alternate" | "horizontal" | undefined
  >();
  expectTypeOf<TimelineListRootProps["spacing"]>().toEqualTypeOf<"default" | "compact" | undefined>();
  expectTypeOf<TimelineListRootProps["indicatorSize"]>().toEqualTypeOf<"dot" | "md" | "lg" | undefined>();
  expectTypeOf<TimelineListItemProps>().toExtend<ComponentProps<"li">>();
  expectTypeOf<ComponentProps<"li">>().toExtend<TimelineListItemProps>();
  expectTypeOf<TimelineListItemProps["status"]>().toEqualTypeOf<
    "complete" | "current" | "upcoming" | "error" | undefined
  >();
  expectTypeOf<TimelineListItemProps["statusLabel"]>().toEqualTypeOf<string | undefined>();
  // The parts each take their element's props.
  expectTypeOf<TimelineListOppositeProps>().toExtend<ComponentProps<"div">>();
  expectTypeOf<ComponentProps<"div">>().toExtend<TimelineListOppositeProps>();
  expectTypeOf<TimelineListIndicatorProps>().toExtend<ComponentProps<"div">>();
  expectTypeOf<ComponentProps<"div">>().toExtend<TimelineListIndicatorProps>();
  expectTypeOf<TimelineListMarkProps>().toExtend<ComponentProps<"span">>();
  expectTypeOf<ComponentProps<"span">>().toExtend<TimelineListMarkProps>();
  expectTypeOf<TimelineListContentProps>().toEqualTypeOf<ComponentProps<"div">>();
  expectTypeOf<TimelineListIndicatorProps["children"]>().toEqualTypeOf<ReactNode>();
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
    <TimelineList.Root className="max-w-md" layout="alternate" spacing="compact" indicatorSize="lg">
      <TimelineList.Item status="current" statusLabel="">
        <TimelineList.Opposite className="tabular-nums">3 March</TimelineList.Opposite>
        <TimelineList.Indicator>{null}</TimelineList.Indicator>
        <TimelineList.Content id="placed">
          <TimelineList.Title>Order placed</TimelineList.Title>
          <TimelineList.Time date="2024-03-03T10:00:00.000Z">3 March 2024</TimelineList.Time>
          <TimelineList.Time date={new Date("2024-03-03T10:00:00.000Z")}>3 March 2024</TimelineList.Time>
          <TimelineList.Title level={2}>Outline</TimelineList.Title>
          <TimelineList.Description>Confirmed at checkout.</TimelineList.Description>
        </TimelineList.Content>
      </TimelineList.Item>
      <TimelineList.Item>
        <TimelineList.Indicator>
          <TimelineList.Mark aria-label="ignored">
            <svg />
          </TimelineList.Mark>
        </TimelineList.Indicator>
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
  // @ts-expect-error alternate is a layout, never a separate axis beside it
  const _noOrientation = <TimelineList.Root orientation="horizontal" />;
  // @ts-expect-error the indicator size belongs to the Root, so every Item shares one lane
  const _noItemSize = <TimelineList.Item indicatorSize="md" />;
  // @ts-expect-error the indicator is a part, TimelineList.Indicator, not an Item prop
  const _noIndicatorProp = <TimelineList.Item indicator={null} />;
  // @ts-expect-error the opposite content is a part, TimelineList.Opposite, not an Item prop
  const _noOppositeProp = <TimelineList.Item opposite="3 March" />;
  // @ts-expect-error no part takes render; they are markup parts
  const _noRender = <TimelineList.Indicator render={<div />} />;
  // @ts-expect-error a status label belongs to a status
  const _labelWithoutStatus = <TimelineList.Item statusLabel="Delivered" />;
  // @ts-expect-error status takes only the four named statuses
  const _noTone = <TimelineList.Item status="warning" />;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <TimelineList.Root as="ul" />;
});
