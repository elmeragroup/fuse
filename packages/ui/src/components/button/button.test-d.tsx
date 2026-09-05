import { expectTypeOf, test } from "vitest";

import type { Button as RootButton } from "@elmeragroup/ui";
import type { ButtonProps } from "@elmeragroup/ui/button";
import { Button, buttonVariants } from "@elmeragroup/ui/button";

test("icon-only sizes require an accessible name", () => {
  const labeled = { size: "icon", "aria-label": "Close" } satisfies ButtonProps;
  const labeledInline = { size: "icon-inline", "aria-label": "Open" } satisfies ButtonProps;
  const text = { children: "Save" } satisfies ButtonProps;

  expectTypeOf(labeled["aria-label"]).toEqualTypeOf<string>();
  expectTypeOf(labeled.size).toEqualTypeOf<"icon">();
  expectTypeOf(labeledInline.size).toEqualTypeOf<"icon-inline">();
  expectTypeOf(text).not.toHaveProperty("aria-label");

  // @ts-expect-error icon size requires aria-label
  const _missingIcon: ButtonProps = { size: "icon" };
  // @ts-expect-error icon-xs size requires aria-label
  const _missingIconXs: ButtonProps = { size: "icon-xs" };
  // @ts-expect-error icon-sm size requires aria-label
  const _missingIconSm: ButtonProps = { size: "icon-sm" };
  // @ts-expect-error icon-lg size requires aria-label
  const _missingIconLg: ButtonProps = { size: "icon-lg" };
  // @ts-expect-error icon-inline size requires aria-label
  const _missingIconInline: ButtonProps = { size: "icon-inline" };

  const _ok = <Button size="icon" aria-label="Delete" />;
});

test("polymorphism is render, not as, and the public recipe is exported", () => {
  expectTypeOf<ButtonProps>().not.toHaveProperty("as");
  expectTypeOf<typeof Button>().toEqualTypeOf<typeof RootButton>();
  expectTypeOf(buttonVariants).toBeFunction();
  expectTypeOf(buttonVariants({ variant: "destructive", size: "sm" })).toBeString();
});
