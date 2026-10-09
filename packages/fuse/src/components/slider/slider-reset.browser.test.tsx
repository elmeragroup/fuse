import { useState } from "react";

import { expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { formNamed, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Slider } from "./slider";
import type { SliderValue } from "./slider";

function valueNow(name: string): number {
  return Number(roleNamed("slider", name).getAttribute("aria-valuenow"));
}

/**
 * The reset listener's plumbing is proved in `use-form-reset.browser.test.tsx`. Slider
 * remounts its base-ui root on reset, as NumberField does, so these cases prove the remount
 * restores the uncontrolled value and what the form submits, and keeps focus on its thumb.
 */
it("restores an uncontrolled value on native reset, and submits it", async () => {
  const onChange = vi.fn();
  renderThemed(
    withLocale(
      "en-US",
      <form aria-label="Volume form">
        <Slider label="Volume" name="volume" defaultValue={30} onChange={onChange} />
      </form>
    )
  );
  roleNamed("slider", "Volume").focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  expect(valueNow("Volume")).toBe(32);
  const edits = onChange.mock.calls.length;

  formNamed("Volume form").reset();

  await expect.poll(() => valueNow("Volume")).toBe(30);
  expect(document.activeElement, "the remount keeps focus on the thumb").toBe(roleNamed("slider", "Volume"));
  expect(onChange, "native reset does not call onChange").toHaveBeenCalledTimes(edits);
  expect(new FormData(formNamed("Volume form")).getAll("volume")).toEqual(["30"]);
});

it("restores an uncontrolled range on native reset, and keeps focus on the thumb that held it", async () => {
  renderThemed(
    withLocale(
      "en-US",
      <form aria-label="Price form">
        <Slider label="Price" name="price" defaultValue={[20, 80]} />
      </form>
    )
  );
  roleNamed("slider", "Price, maximum").focus();
  await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
  expect(valueNow("Price, maximum")).toBe(77);

  formNamed("Price form").reset();

  await expect.poll(() => valueNow("Price, maximum")).toBe(80);
  expect(valueNow("Price, minimum")).toBe(20);
  expect(document.activeElement).toBe(roleNamed("slider", "Price, maximum"));
  expect(new FormData(formNamed("Price form")).getAll("price")).toEqual(["20", "80"]);
});

it("keeps a controlled value parent-owned through native reset", async () => {
  function ControlledVolume() {
    const [current, setCurrent] = useState(30);
    return (
      <form aria-label="Volume form">
        <Slider label="Volume" name="volume" value={current} onChange={setCurrent} />
        <Slider label="Balance" defaultValue={50} />
      </form>
    );
  }
  renderThemed(withLocale("en-US", <ControlledVolume />));
  roleNamed("slider", "Volume").focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  expect(valueNow("Volume")).toBe(32);
  roleNamed("slider", "Balance").focus();
  await userEvent.keyboard("{ArrowRight}");

  formNamed("Volume form").reset();
  // The uncontrolled sibling resets in the same task a controlled remount would, so once it
  // is back the controlled slider has had its chance to reset.
  await expect.poll(() => valueNow("Balance")).toBe(50);

  expect(valueNow("Volume")).toBe(32);
  expect(new FormData(formNamed("Volume form")).getAll("volume")).toEqual(["32"]);
});

it("keeps focus on the surviving thumb when a reset shrinks the range, and resets again", async () => {
  const price = (defaultValue: SliderValue) =>
    withLocale(
      "en-US",
      <form aria-label="Price form">
        <Slider label="Price" name="price" defaultValue={defaultValue} />
      </form>
    );
  const { rerender } = renderThemed(price([20, 80]));
  roleNamed("slider", "Price, maximum").focus();
  rerender(price(50));

  formNamed("Price form").reset();

  await expect.poll(() => valueNow("Price")).toBe(50);
  expect(document.activeElement, "focus moves to the one thumb left").toBe(roleNamed("slider", "Price"));

  await userEvent.keyboard("{ArrowRight}");
  expect(valueNow("Price")).toBe(51);
  formNamed("Price form").reset();

  await expect.poll(() => valueNow("Price")).toBe(50);
  expect(document.activeElement).toBe(roleNamed("slider", "Price"));
  expect(new FormData(formNamed("Price form")).getAll("price")).toEqual(["50"]);
});
