/**
 * Unit under test: the code syntax `fuseVariableSet` gives the tints and formula variables that
 * Item, Empty, Alert, Accordion and the floating Sidebar paint and space with, as
 * `buildComponentSet` binds it. Oracle: Tailwind's compile of the classes Fuse writes for them, read on the `chip`
 * fixture. No kit set renders these components yet, so no kit test reaches these classes. Each
 * fixture copies its class from the Fuse source the comment names, because the recipe catalog
 * does not export it yet.
 */
import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { density, fixed, paint, token } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf } from "../../test/fixture-sets";
import { fuseVariableSet } from "../fuse-variable-set";
import { makeVariableIndex } from "./css-values";
import type { VariableIndex } from "./css-values";

/** Every synced variable that carries code syntax, which a compiled value can bind. */
function syncedVariables(): VariableIndex {
  const set = fuseVariableSet();
  if (Result.isFailure(set)) {
    throw new Error(`the Fuse variable set does not build: ${String(set.failure)}`);
  }
  return makeVariableIndex(
    set.success.collections.flatMap((collection) =>
      collection.variables.flatMap((variable) =>
        variable.webSyntax === undefined
          ? []
          : [{ ref: { collection: collection.name, name: variable.name }, webSyntax: variable.webSyntax }]
      )
    )
  );
}

/**
 * `publishInnerCorner` in `corner-radius.ts`, which every shell below composes through
 * `publishShellBoundary`. The boundary's `[--shell-corner:initial]` clears a relay no part here reads.
 */
const PUBLISH_INNER_CORNER = "[--inner-corner:var(--shell-inner)]";

describe("the tints and formulas of Item, Empty, Alert, Accordion and the floating Sidebar", () => {
  it.each([
    // The muted Item, `item-variants.ts`.
    ["bg-muted/50", "muted/50"],
    // The destructive and success Alerts, `alert-variants.ts`.
    ["bg-error/5", "error/5"],
    ["bg-success/5", "success/5"],
  ])("binds %s to the %s tint", async (fill, tint) => {
    const { variant, coverage } = await buildFixture(chip(fill), { variables: syncedVariables() });
    expect(variant?.root.fill).toEqual(paint(tint));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });

  it("binds Empty's desktop padding, twice the large surface tier", async () => {
    // `emptyShellClass` in `inner-corner/empty.ts`, without its `md:` arm.
    const { variant, coverage } = await buildFixture(chip("p-[calc(2*var(--surface-pad-lg))]"), {
      variables: syncedVariables(),
    });
    const padding = density("empty-pad-desktop");
    expect(variant?.root).toMatchObject({
      paddingTop: padding,
      paddingRight: padding,
      paddingBottom: padding,
      paddingLeft: padding,
    });
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });

  it("binds the space above an open Accordion panel's text", async () => {
    // `contentInner` in `accordion-variants.ts`.
    const { variant, coverage } = await buildFixture(
      chip("pt-[calc(var(--surface-gap-lg)+--spacing(1.5))]"),
      {
        variables: syncedVariables(),
      }
    );
    expect(variant?.root.paddingTop).toEqual(density("accordion-panel-pt"));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });

  it("binds an Alert's media line, one snug line of label text", async () => {
    // `ALERT_MEDIA_LINE` in `alert.tsx`, without its `item-described:` arm, read as Item's icon
    // media reads it.
    const { variant, coverage } = await buildFixture(
      chip("[--item-media-line:calc(var(--label-text)*var(--leading-snug))] h-(--item-media-line)"),
      { variables: syncedVariables() }
    );
    expect(variant?.root.sizing.vertical).toEqual(fixed(density("label-line-snug")));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });

  it.each([
    // `accordionItemShellClass` in `inner-corner/accordion.ts`.
    ["[--shell-inner:max(0px,--theme(--radius-sm)-var(--surface-pad-md))]", "radius-inner/sm-pad-md"],
    // `accordionItemLgShellClass`, and `toastShellClass` in `inner-corner/toast.ts`.
    ["[--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))]", "radius-inner/lg-pad-md"],
    // `accordionItemXlShellClass`.
    ["[--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-md))]", "radius-inner/xl-pad-md"],
    // `accordionCardItemShellClass` and `accordionCardItemLgShellClass`.
    [
      "[--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--surface-pad-md))]",
      "radius-inner/lg-border-pad-md",
    ],
    // `accordionCardItemXlShellClass`.
    [
      "[--shell-inner:max(0px,--theme(--radius-xl)-1px-var(--surface-pad-md))]",
      "radius-inner/xl-border-pad-md",
    ],
    // `sidebarSectionShellClass` in `inner-corner/sidebar.ts`, floating, without its context arms.
    ["[--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-sm))]", "radius-inner/lg-pad-sm"],
  ])("binds rounded-inner inside the shell %s to %s", async (shell, corner) => {
    const { variant, coverage } = await buildFixture(
      chip(`${shell} ${PUBLISH_INNER_CORNER}`, { parts: [dot("rounded-inner")] }),
      { variables: syncedVariables() }
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(density(corner));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });

  it("binds rounded-inner inside the floating Sidebar's group in the icon rail", async () => {
    // `sidebarSectionShellClass` in `inner-corner/sidebar.ts`, collapsed to the icon rail, without
    // its context arms.
    const { variant, coverage } = await buildFixture(
      chip(`[--shell-inner:max(0px,--theme(--radius-lg)-2*var(--spacing))] ${PUBLISH_INNER_CORNER}`, {
        parts: [dot("rounded-inner")],
      }),
      { variables: syncedVariables() }
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(token("radius-inner/lg-pad-8px"));
    expect(coverage.filter((row) => row.outcome !== "bound")).toEqual([]);
  });
});
