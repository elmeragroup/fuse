import type { ReactNode } from "react";

import type { ValidationResult } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertStateFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { describedTextsFor } from "../../../test/rac-calendar-testing";
import {
  CONTROL_MD,
  LABEL,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { UiProviders } from "../ui-providers/ui-providers";
import { SearchField } from "./search-field";

function renderField(node: ReactNode) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

/**
 * The private RAC `FieldGroup` wrapping the named searchbox. It carries `role="group"`
 * but no accessible name of its own, so it is reached from the control it labels — it is
 * the field box that pins the `md` rung and hosts the shared
 * `focusRing({ target: "state" })` ring.
 */
function fieldGroupFor(name: string): HTMLElement {
  const group = roleNamed("searchbox", name).closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error(`expected the SearchField field group around ${name}`);
  }
  return group;
}

function fieldRootFrom(name: string): HTMLElement {
  const root = roleNamed("searchbox", name).parentElement?.parentElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected SearchField root around ${name}`);
  }
  return root;
}

function clearButtonNamed(name: RegExp): HTMLElement {
  const element = page.getByRole("button", { name }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected clear button ${String(name)}`);
  }
  return element;
}

describe("SearchField", () => {
  it("clears from the named button and hides that button while empty", async () => {
    const onClear = vi.fn();
    renderField(<SearchField label="Meter search" defaultValue="735999123" onClear={onClear} />);

    const input = roleNamed("searchbox", "Meter search");
    const root = fieldRootFrom("Meter search");
    expect(root.hasAttribute("data-empty")).toBe(false);

    const clear = clearButtonNamed(/clear/i);
    expect(getComputedStyle(clear).visibility).toBe("visible");
    await userEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveProperty("value", "");
    expect(root).toHaveAttribute("data-empty");
    expect(getComputedStyle(clear).visibility).toBe("hidden");
  });

  it("reflects isDisabled and isInvalid on the root and renders errorMessage only when invalid", async () => {
    let functionValidation: ValidationResult | undefined;
    renderField(
      <>
        <SearchField label="Disabled" isDisabled defaultValue="735999123" />
        <SearchField
          label="Valid"
          description="Search by meter number."
          errorMessage="Enter a query."
          defaultValue="735999123"
        />
        <SearchField label="String error" isInvalid errorMessage="Enter a query." defaultValue="" />
        <SearchField
          label="Function error"
          isInvalid
          errorMessage={(result) => {
            functionValidation = result;
            return (
              <span role="status" aria-label="Function error details">
                Query is required
              </span>
            );
          }}
        />
      </>
    );

    expect(fieldRootFrom("Disabled")).toHaveAttribute("data-disabled");
    expect(fieldRootFrom("String error")).toHaveAttribute("data-invalid");
    expect(fieldRootFrom("Function error")).toHaveAttribute("data-invalid");
    expect(fieldRootFrom("Valid").hasAttribute("data-invalid")).toBe(false);
    expect(functionValidation?.isInvalid).toBe(true);

    expect(describedTextsFor(roleNamed("searchbox", "Valid"))).toContain("Search by meter number.");
    expect(describedTextsFor(roleNamed("searchbox", "Valid"))).not.toContain("Enter a query.");
    expect(fieldRootFrom("Valid").textContent).not.toContain("Enter a query.");

    expect(describedTextsFor(roleNamed("searchbox", "String error"))).toContain("Enter a query.");
    const functionError = page.getByRole("status", { name: "Function error details" });
    await expect.element(functionError).toBeVisible();
    const functionErrorNode = functionError.element();
    if (!(functionErrorNode instanceof HTMLElement)) {
      throw new Error("expected function error node");
    }
    expect(fieldRootFrom("Function error").contains(functionErrorNode)).toBe(true);
    expect(describedTextsFor(roleNamed("searchbox", "Function error"))).toContain("Query is required");
  });

  it("paints the shared state ring on the field group for keyboard focus at both densities", async () => {
    renderField(
      <>
        <button type="button">Before</button>
        <SearchField label="Meter search" />
      </>
    );

    await assertStateFocusRingAtBothDensities(
      roleNamed("button", "Before"),
      roleNamed("searchbox", "Meter search"),
      fieldGroupFor("Meter search")
    );
  });

  it("pins the field box to the signed md rung at both densities and ignores a nested stamp", () => {
    renderField(
      <>
        <SearchField label="Root" />
        <div data-density="comfortable">
          <SearchField label="Nested" />
        </div>
      </>
    );

    // Density is a document-root axis: `fuse.css` keys the comfortable block on
    // `:root[data-density="comfortable"]`, so a nested attribute rescopes nothing
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const rung = CONTROL_MD[density].height;
      expect(px(getComputedStyle(fieldGroupFor("Root")).height)).toBe(rung);
      expect(px(getComputedStyle(fieldGroupFor("Nested")).height)).toBe(rung);
    }
  });

  it("names the clear button from the dictionary in every shipped locale, below an explicit label", async () => {
    const expected = {
      "nb-NO": "Tøm søket",
      "sv-SE": "Rensa sökningen",
      "en-US": "Clear search",
      "fi-FI": "Tyhjennä haku",
    } as const;
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(
        withLocale(locale, <SearchField label="Meter search" defaultValue="735999123" />)
      );
      await expect.element(page.getByRole("button", { name: expected[locale] })).toBeVisible();
      unmount();
    }

    renderThemed(
      withLocale(
        "nb-NO",
        <SearchField label="Meter search" defaultValue="735999123" clearLabel="Tøm feltet" />
      )
    );

    await expect.element(page.getByRole("button", { name: "Tøm feltet" })).toBeVisible();
    expect(page.getByRole("button", { name: "Tøm søket" }).query()).toBeNull();
  });
});

describe("SearchField text follows density", () => {
  it("sets its label and description in the label type, as a Fuse Field does", () => {
    renderField(<SearchField label="Customer search" description="Search by name or number" />);
    for (const density of DENSITIES) {
      stampDensity(density);
      for (const text of ["Customer search", "Search by name or number"]) {
        const style = getComputedStyle(textNamed(text));
        expect({ font: px(style.fontSize), leading: px(style.lineHeight) }, `${density} ${text}`).toEqual(
          LABEL[density]
        );
      }
    }
    document.documentElement.removeAttribute("data-density");
  });
});
