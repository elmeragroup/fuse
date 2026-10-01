import { expectTypeOf, test } from "vitest";

import type {
  ButtonProps,
  ButtonSize,
  IconButtonProps,
  IconButtonSize,
  LabelButtonProps,
  LabelButtonSize,
} from "@elmeragroup/fuse/button";
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

test("the size unions are the recipe's sizes, split at the icon prefix", () => {
  expectTypeOf<ButtonSize>().toEqualTypeOf<
    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-inline" | "icon-lg"
  >();
  expectTypeOf<LabelButtonSize>().toEqualTypeOf<"default" | "xs" | "sm" | "lg">();
  expectTypeOf<IconButtonSize>().toEqualTypeOf<"icon" | "icon-xs" | "icon-sm" | "icon-inline" | "icon-lg">();
});

test("label props take every label size, no icon size, and need no accessible name", () => {
  ({}) satisfies LabelButtonProps;
  ({ size: "xs", children: "Back" }) satisfies LabelButtonProps;
  ({ size: "lg", children: "Continue" }) satisfies LabelButtonProps;

  // @ts-expect-error an icon size is not a label size
  const _icon: LabelButtonProps = { size: "icon", "aria-label": "Close" };
  // @ts-expect-error an icon size is not a label size, even with children
  const _iconSm: LabelButtonProps = { size: "icon-sm", children: "x" };
});

test("icon props require an icon size and an accessible name", () => {
  ({ size: "icon", "aria-label": "Close" }) satisfies IconButtonProps;
  ({ size: "icon-lg", "aria-label": "Search" }) satisfies IconButtonProps;

  // @ts-expect-error the size is required
  const _noSize: IconButtonProps = { "aria-label": "Close" };
  // @ts-expect-error a label size is not an icon size
  const _labelSize: IconButtonProps = { size: "sm", "aria-label": "Close" };
  // @ts-expect-error aria-label is required
  const _noName: IconButtonProps = { size: "icon" };
});

test("a wrapper omits children from the label props without collapsing the union", () => {
  // The reason the types are exported: `Omit<ButtonProps, …>` is not distributive, so it
  // merges the two arms and lets an icon size through without its name.
  type Collapsed = Omit<ButtonProps, "children">;
  ({ size: "icon" }) satisfies Collapsed;

  type LoadingButtonProps = Omit<LabelButtonProps, "children"> & { label: string; isLoading?: boolean };
  ({ label: "Save", size: "sm" }) satisfies LoadingButtonProps;
  // @ts-expect-error the label wrapper rejects icon sizes
  const _iconWrapper: LoadingButtonProps = { label: "Save", size: "icon" };

  function LoadingButton({ label, isLoading, ...props }: LoadingButtonProps) {
    // The rest spreads back onto Button: a label arm stays a label arm.
    return (
      <Button {...props} isPending={isLoading}>
        {label}
      </Button>
    );
  }
  const _rendered = <LoadingButton label="Save" size="lg" variant="outline" />;

  type IconLinkProps = Omit<IconButtonProps, "children"> & { icon: string };
  function IconLink({ icon: _icon, ...props }: IconLinkProps) {
    return <Button {...props} />;
  }
  const _iconRendered = <IconLink icon="x" size="icon-sm" aria-label="Open" />;
  // @ts-expect-error the icon wrapper still needs the accessible name
  const _unnamed = <IconLink icon="x" size="icon-sm" />;
});

test("pendingIndicator takes a node, null or false on both arms and keeps the icon name rule", () => {
  ({ isPending: true, pendingIndicator: null, children: "Save" }) satisfies ButtonProps;
  ({ isPending: true, pendingIndicator: false, children: "Save" }) satisfies ButtonProps;
  ({ isPending: true, pendingIndicator: <svg />, children: "Save" }) satisfies ButtonProps;
  ({ size: "icon", "aria-label": "Refresh", pendingIndicator: null }) satisfies ButtonProps;

  // @ts-expect-error an icon size still requires its accessible name
  const _unnamed: ButtonProps = { size: "icon", pendingIndicator: null };
  // @ts-expect-error a component function is not a node; pass the element
  const _fn: ButtonProps = { pendingIndicator: () => <svg /> };
});
