import { expectTypeOf, test } from "vitest";

import type { Badge as RootBadge } from "@elmeragroup/fuse";
import type { BadgeProps } from "@elmeragroup/fuse/badge";
import { Badge, badgeVariants } from "@elmeragroup/fuse/badge";

test("Badge ships from the badge entry and the root barrel", () => {
  expectTypeOf<typeof Badge>().toEqualTypeOf<typeof RootBadge>();
  expectTypeOf(Badge).toBeFunction();
});

test("BadgeProps is native div props plus the recipe axes", () => {
  expectTypeOf<BadgeProps["variant"]>().toEqualTypeOf<
    | "default"
    | "secondary"
    | "destructive"
    | "success"
    | "warning"
    | "info"
    | "outline"
    | "outline-secondary"
    | "outline-destructive"
    | "outline-success"
    | "outline-warning"
    | "muted"
    | "accent"
    | "card"
    | undefined
  >();
  expectTypeOf<BadgeProps["size"]>().toEqualTypeOf<"sm" | "default" | "lg" | undefined>();
  expectTypeOf<BadgeProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<BadgeProps["id"]>().toEqualTypeOf<string | undefined>();
});

test("badgeVariants is public and returns a class string", () => {
  expectTypeOf(badgeVariants).toBeFunction();
  expectTypeOf(badgeVariants({ variant: "outline-destructive", size: "lg" })).toBeString();
  expectTypeOf(badgeVariants()).toBeString();
});

test("the element takes the public props and no polymorphic as prop", () => {
  const _basic = <Badge>Active</Badge>;
  const _statused = (
    <Badge variant="success" size="sm" className="uppercase">
      Active
    </Badge>
  );

  // @ts-expect-error `error` is not a variant value; the consumer-compat name is `destructive`
  const _badVariant = <Badge variant="error" />;
  // @ts-expect-error decorative sizes are sm | default | lg only
  const _badSize = <Badge size="xl" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Badge as="span" />;
});
