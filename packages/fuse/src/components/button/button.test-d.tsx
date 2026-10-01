import { expectTypeOf, test } from "vitest";

import type { ButtonProps } from "@elmeragroup/fuse/button";
import { Button } from "@elmeragroup/fuse/button";

test("icon-only sizes require an accessible name", () => {
  ({ size: "icon", "aria-label": "Close" }) satisfies ButtonProps;
  ({ size: "icon-inline", "aria-label": "Open" }) satisfies ButtonProps;
  ({ children: "Save" }) satisfies ButtonProps;

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
  expectTypeOf<ButtonProps>().not.toHaveProperty("as");
});

test("wrap is a boolean on every arm, so a wrapper can spread it through", () => {
  ({ wrap: true, children: "A long call to action" }) satisfies ButtonProps;
  ({ size: "xs", wrap: true, children: "Back" }) satisfies ButtonProps;
  ({ size: "icon", "aria-label": "Close", wrap: false }) satisfies ButtonProps;

  // @ts-expect-error wrap is a boolean, not a mode name
  const _mode: ButtonProps = { wrap: "normal" };
  const _rendered = <Button wrap>Continue</Button>;
});
