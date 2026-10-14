import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { cornerRadius, RADIUS_XL } from "../../../test/inner-corner-specimens";
import { withLocale } from "../../../test/locale-matrix";
import { bySlot } from "../../../test/sidebar-browser-fixtures";
import {
  fkasExternal,
  fkasPrivate,
  metricPx,
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { ThemeScope } from "../../theme/theme-scope";
import { Command } from "./index";

const COMMANDS = ["New customer", "Open invoices", "Register meter reading"];

/** A dialog palette with every part the palette insets: the input, the list's rows and the footer. */
function GeometryPalette(): ReactElement {
  return (
    <Command.Root items={COMMANDS}>
      <Command.Trigger>Open palette</Command.Trigger>
      <Command.Content>
        <Command.Input />
        <Command.List>
          {(command: string) => (
            <Command.Item key={command} value={command}>
              {command}
            </Command.Item>
          )}
        </Command.List>
        <Command.Footer>
          <Command.NavigateHint />
        </Command.Footer>
      </Command.Content>
    </Command.Root>
  );
}

/** Opens the palette from its trigger and waits for the dialog to focus its input. */
async function openPalette(): Promise<HTMLElement> {
  await userEvent.click(roleNamed("button", "Open palette"));
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  await expect.poll(() => document.activeElement).toBe(roleNamed("combobox", "Search commands"));
  return roleNamed("dialog", "Command palette");
}

/** One internal theme, whose row corners round to 0, and one external, whose corners are positive. */
const GEOMETRY_CASES = [
  ["internal", fkasPrivate, fkasExternal],
  ["fkas", fkasExternal, fkasPrivate],
] as const;

describe("Command.Content geometry", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
  });

  afterEach(() => {
    restoreDocumentTheme();
  });

  for (const density of DENSITIES) {
    it.each(GEOMETRY_CASES)(
      `insets its parts by the small surface gap and rounds its rows concentrically (%s, ${density})`,
      async (variant, theme, documentTheme) => {
        // The document carries other radii, so the portaled popup must read the scope's theme.
        stampDocumentTheme(documentTheme, "light");
        stampDensity(density);
        render(
          withLocale(
            "en-US",
            <ThemeScope theme={theme}>
              <GeometryPalette />
            </ThemeScope>
          )
        );
        const popup = await openPalette();
        // DOM audit: the input group and the footer have no role of their own, so the test
        // measures the palette's parts by their public `data-slot`.
        const list = bySlot("command-list", popup);
        const input = getComputedStyle(bySlot("command-input", popup));
        const footer = getComputedStyle(bySlot("command-footer", popup));
        const listStyle = getComputedStyle(list);
        const inset = metricPx("surface-gap-sm", density);

        expect(cornerRadius(popup), "popup corner").toBe(RADIUS_XL[variant]);
        expect(
          {
            list: [
              listStyle.paddingTop,
              listStyle.paddingRight,
              listStyle.paddingBottom,
              listStyle.paddingLeft,
            ].map(px),
            input: [input.marginTop, input.marginLeft, input.marginRight].map(px),
            footer: [footer.paddingTop, footer.paddingBottom].map(px),
          },
          "shared inset"
        ).toEqual({
          list: [inset, inset, inset, inset],
          input: [inset, inset, inset],
          footer: [inset, inset],
        });

        // Unit under test: the row's `rounded-inner` corner. Oracle: the concentric rule,
        // max(0, outer - inset), on the popup's computed corner and the list's computed padding.
        const row = roleNamed("option", "New customer");
        expect(cornerRadius(row), "row corner").toBe(
          Math.max(0, cornerRadius(popup) - px(listStyle.paddingTop))
        );
      }
    );
  }
});
