import { useState } from "react";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertWithinKeyboardFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { expectInvalidFocusRing, expectInvalidRing } from "../../../test/assert-invalid-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { whilePointerPressed } from "../../../test/pointer-press";
import {
  CONTROL_MD,
  cssVarColor,
  effectiveOpacity,
  formNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { DENSITIES } from "../../theme";
import { Slider } from "./slider";
import type { SliderValue } from "./slider";

/** The range thumbs' default names per locale, written by hand for a slider labelled "Pris". */
const RANGE_NAMES = {
  "en-US": ["Pris, minimum", "Pris, maximum"],
  "nb-NO": ["Pris, minimum", "Pris, maksimum"],
  "sv-SE": ["Pris, minimum", "Pris, maximum"],
  "fi-FI": ["Pris, minimi", "Pris, maksimi"],
} as const;

/** The same thumbs' value text for `[0.5, 2.5]`, written by hand per locale. */
const RANGE_VALUE_TEXT = {
  "en-US": ["0.5", "2.5"],
  "nb-NO": ["0,5", "2,5"],
  "sv-SE": ["0,5", "2,5"],
  "fi-FI": ["0,5", "2,5"],
} as const;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

/** The focusable `role="slider"` input of the thumb named `name`. */
function sliderNamed(name: string): HTMLInputElement {
  const input = roleNamed("slider", name);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`expected an <input> slider named ${name}`);
  }
  return input;
}

/** The painted thumb around the slider input named `name`. */
function thumbOf(name: string): HTMLElement {
  const thumb = sliderNamed(name).parentElement;
  if (!(thumb instanceof HTMLElement)) {
    throw new Error(`expected a thumb around ${name}`);
  }
  return thumb;
}

/** The control box the thumb moves in: the thumb's positioned parent. */
function controlOf(name: string): HTMLElement {
  const control = thumbOf(name).parentElement;
  if (!(control instanceof HTMLElement)) {
    throw new Error(`expected a control around ${name}`);
  }
  return control;
}

/** Every slider reads the provider locale, so each suite render supplies one. */
function renderSlider(node: ReactNode, locale: SupportedLocale = "en-US") {
  return renderThemed(withLocale(locale, node));
}

function valueNow(name: string): number {
  return Number(sliderNamed(name).getAttribute("aria-valuenow"));
}

function describedByText(element: HTMLElement): string[] {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "");
}

describe("Slider", () => {
  it("exposes the thumb as a slider with its value and bounds", () => {
    renderSlider(<Slider label="Volume" defaultValue={30} minValue={10} maxValue={90} />);
    const input = sliderNamed("Volume");
    expect(input.getAttribute("aria-valuenow")).toBe("30");
    expect(input.getAttribute("min")).toBe("10");
    expect(input.getAttribute("max")).toBe("90");
    expect(input.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("names the thumb through the Field label, and through aria-label without one", () => {
    renderSlider(
      <>
        <Slider label="Volume" description="Master output." defaultValue={30} />
        <Slider aria-label="Radius" defaultValue={8} />
      </>
    );
    const labelled = sliderNamed("Volume");
    expect(labelled.getAttribute("aria-label")).toBeNull();
    const labelledBy = labelled.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(labelledBy)?.textContent).toBe("Volume");
    expect(describedByText(labelled)).toContain("Master output.");
    expect(valueNow("Radius")).toBe(8);
  });

  it("moves by step on the arrows and by largeStep on PageUp/PageDown, and to the bounds on Home/End", async () => {
    const onChange = vi.fn();
    renderSlider(
      <Slider
        label="Size"
        defaultValue={50}
        minValue={0}
        maxValue={100}
        step={5}
        largeStep={20}
        onChange={onChange}
      />
    );
    sliderNamed("Size").focus();
    const expected: [string, number][] = [
      ["{ArrowRight}", 55],
      ["{ArrowLeft}", 50],
      ["{PageUp}", 70],
      ["{PageDown}", 50],
      ["{End}", 100],
      ["{Home}", 0],
    ];
    for (const [key, value] of expected) {
      await userEvent.keyboard(key);
      expect(valueNow("Size"), key).toBe(value);
      expect(onChange, key).toHaveBeenLastCalledWith(value);
    }
  });

  it("round-trips a controlled value through onChange and onValueCommitted, and holds when the parent ignores it", async () => {
    const commits: number[] = [];
    function Controlled() {
      const [value, setValue] = useState(40);
      return (
        <>
          <Slider
            label="Controlled"
            value={value}
            onChange={setValue}
            onValueCommitted={(next) => commits.push(next)}
          />
          <Slider label="Pinned" value={10} onChange={vi.fn()} />
          <p>Parent {value}</p>
        </>
      );
    }
    renderSlider(<Controlled />);
    sliderNamed("Controlled").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(valueNow("Controlled")).toBe(42);
    expect(page.getByText("Parent 42", { exact: true }).query()).toBeTruthy();
    expect(commits).toEqual([41, 42]);

    sliderNamed("Pinned").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(valueNow("Pinned")).toBe(10);
  });

  it.each(SUPPORTED_LOCALES)(
    "names each range thumb on its own and announces its formatted value alone in %s, reporting the range's shape",
    async (locale) => {
      const onChange = vi.fn();
      const commits: (readonly number[])[] = [];
      renderSlider(
        <Slider
          label="Pris"
          defaultValue={[0.5, 2.5]}
          maxValue={5}
          step={0.5}
          onChange={onChange}
          onValueCommitted={(value) => commits.push(value)}
        />,
        locale
      );
      const [startName, endName] = RANGE_NAMES[locale];
      const [startText, endText] = RANGE_VALUE_TEXT[locale];
      expect(valueNow(startName)).toBe(0.5);
      expect(valueNow(endName)).toBe(2.5);
      expect(sliderNamed(startName).getAttribute("aria-valuetext")).toBe(startText);
      expect(sliderNamed(endName).getAttribute("aria-valuetext")).toBe(endText);

      sliderNamed(endName).focus();
      await userEvent.keyboard("{ArrowLeft}");
      expect(onChange).toHaveBeenLastCalledWith([0.5, 2]);
      expect(commits).toEqual([[0.5, 2]]);
    }
  );

  it("keeps an uncontrolled range's thumbs and values when defaultValue changes after mount", () => {
    const { rerender } = renderSlider(<Slider label="Pris" defaultValue={[20, 80]} />);
    rerender(withLocale("en-US", <Slider label="Pris" defaultValue={50} />));
    expect(valueNow("Pris, minimum")).toBe(20);
    expect(valueNow("Pris, maximum")).toBe(80);
  });

  it("treats a one-number array from untyped code as a single value, for keyboard and pointer alike", async () => {
    const onChange = vi.fn();
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider
          label="Level"
          // @ts-expect-error the types reject a one-number array, but untyped callers can pass one
          defaultValue={[50]}
          onChange={onChange}
        />
      </div>
    );
    expect(page.getByRole("slider").elements()).toHaveLength(1);
    expect(valueNow("Level")).toBe(50);

    sliderNamed("Level").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(51);

    const control = controlOf("Level");
    const box = control.getBoundingClientRect();
    await userEvent.click(page.elementLocator(control), {
      position: { x: box.width * 0.25, y: box.height / 2 },
    });
    expect(valueNow("Level")).toBeGreaterThanOrEqual(23);
    expect(valueNow("Level")).toBeLessThanOrEqual(27);
    expect(onChange).toHaveBeenLastCalledWith(valueNow("Level"));
  });

  it("names range thumbs from aria-label, and lets thumbLabels override the dictionary", () => {
    renderSlider(
      <>
        <Slider aria-label="Spacing" defaultValue={[2, 6]} />
        <Slider label="Hours" defaultValue={[8, 16]} thumbLabels={["Opens", "Closes"]} />
      </>
    );
    expect(valueNow("Spacing, minimum")).toBe(2);
    expect(valueNow("Spacing, maximum")).toBe(6);
    expect(valueNow("Opens")).toBe(8);
    expect(valueNow("Closes")).toBe(16);
  });

  it("shows the formatted value in the label row", async () => {
    renderSlider(
      <Slider
        label="Opacity"
        showValue
        defaultValue={0.25}
        minValue={0}
        maxValue={1}
        step={0.05}
        formatOptions={{ style: "percent" }}
      />
    );
    const output = page.getByText("25%", { exact: true }).element();
    expect(output.tagName).toBe("OUTPUT");
    expect(sliderNamed("Opacity").getAttribute("aria-valuetext")).toBe("25%");

    sliderNamed("Opacity").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(output.textContent).toBe("30%");
  });

  it("blocks input when disabled and shows the disabled state face", async () => {
    const onChange = vi.fn();
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider label="Locked" isDisabled defaultValue={20} onChange={onChange} />
      </div>
    );
    const input = sliderNamed("Locked");
    expect(input.disabled).toBe(true);
    expect(getComputedStyle(thumbOf("Locked")).cursor).toBe("not-allowed");

    const box = controlOf("Locked").getBoundingClientRect();
    await userEvent.click(page.elementLocator(controlOf("Locked")), {
      position: { x: box.width * 0.9, y: box.height / 2 },
      force: true,
    });
    input.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(valueNow("Locked")).toBe(20);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps a disabled thumb opaque over the track, in the muted tone of the disabled indicator", () => {
    renderSlider(
      <div style={{ width: 400, height: 240 }}>
        <Slider label="Brightness" showValue isDisabled defaultValue={40} />
        <Slider label="Pris" isDisabled defaultValue={[20, 80]} />
        <Slider label="Level" orientation="vertical" isDisabled defaultValue={40} />
      </div>
    );
    for (const name of ["Brightness", "Pris, minimum", "Pris, maximum", "Level"]) {
      const thumb = thumbOf(name);
      // A translucent thumb lets the indicator and track beneath show through its centre.
      expect(effectiveOpacity(thumb), name).toBe(1);
      expect(getComputedStyle(thumb).backgroundColor, name).toBe(cssVarColor(thumb, "--background"));
      expect(getComputedStyle(thumb).borderTopColor, name).toBe(cssVarColor(thumb, "--muted-foreground"));
      expect(getComputedStyle(thumb).cursor, name).toBe("not-allowed");
    }
  });

  it("wires isInvalid and errorMessage through the Field, with a solid error line inside the halo for keyboard focus and the halo alone at rest", async () => {
    renderSlider(
      <>
        <button type="button">Before</button>
        <Slider label="Invalid budget" isInvalid errorMessage="Too high." defaultValue={30} />
      </>
    );
    expect(sliderNamed("Invalid budget").getAttribute("aria-invalid")).toBe("true");
    expect(describedByText(sliderNamed("Invalid budget"))).toContain("Too high.");
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(sliderNamed("Invalid budget").matches(":focus-visible")).toBe(true);
    expectInvalidFocusRing("focused thumb", thumbOf("Invalid budget"));

    sliderNamed("Invalid budget").blur();
    expectInvalidRing("thumb at rest", thumbOf("Invalid budget"));
  });

  it("paints the shared focus ring on the thumb for keyboard focus", async () => {
    renderSlider(
      <>
        <button type="button">Before</button>
        <Slider label="Focus" defaultValue={50} />
      </>
    );
    await assertWithinKeyboardFocusRingAtBothDensities(
      roleNamed("button", "Before"),
      sliderNamed("Focus"),
      thumbOf("Focus")
    );
  });
});

describe("Slider onValueCommitted", () => {
  it("changes the value along a thumb drag and commits once when it ends, not while it moves", async () => {
    const commits: number[] = [];
    const onChange = vi.fn();
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider
          label="Drag"
          defaultValue={0}
          onChange={onChange}
          onValueCommitted={(value) => commits.push(value)}
        />
      </div>
    );
    const control = controlOf("Drag");
    const box = control.getBoundingClientRect();
    await userEvent.hover(page.elementLocator(thumbOf("Drag")));
    const midDrag = await whilePointerPressed(async () => {
      await userEvent.hover(page.elementLocator(control), {
        position: { x: box.width * 0.75, y: box.height / 2 },
      });
      return { changes: onChange.mock.calls.length, commits: [...commits] };
    });
    // The thumb moved while the button was held, and nothing committed until the release.
    expect(midDrag.changes).toBeGreaterThan(0);
    expect(midDrag.commits).toEqual([]);
    // The thumb centres on the control edges, so 75% of the control's width is 75.
    expect(commits).toHaveLength(1);
    expect(commits[0]).toBeGreaterThanOrEqual(73);
    expect(commits[0]).toBeLessThanOrEqual(77);
    expect(commits[0]).toBe(valueNow("Drag"));
    expect(onChange).toHaveBeenLastCalledWith(valueNow("Drag"));
  });

  it("commits the starting value once when a drag moves away and comes back", async () => {
    const start = 40;
    const commits: number[] = [];
    const onChange = vi.fn();
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider
          label="Return"
          defaultValue={start}
          onChange={onChange}
          onValueCommitted={(value) => commits.push(value)}
        />
      </div>
    );
    const control = controlOf("Return");
    const box = control.getBoundingClientRect();
    const thumb = thumbOf("Return").getBoundingClientRect();
    // The press starts on the thumb's centre, so returning the pointer there returns the value.
    const origin = { x: thumb.left + thumb.width / 2 - box.left, y: box.height / 2 };
    await userEvent.hover(page.elementLocator(control), { position: origin });
    await whilePointerPressed(async () => {
      await userEvent.hover(page.elementLocator(control), {
        position: { x: box.width * 0.75, y: box.height / 2 },
      });
      await userEvent.hover(page.elementLocator(control), { position: origin });
    });
    expect(onChange).toHaveBeenLastCalledWith(start);
    expect(commits).toEqual([start]);
  });

  it("does not commit a press that never moves the value", async () => {
    const commits: number[] = [];
    const onChange = vi.fn();
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider
          label="Still"
          defaultValue={40}
          onChange={onChange}
          onValueCommitted={(value) => commits.push(value)}
        />
      </div>
    );
    await userEvent.hover(page.elementLocator(thumbOf("Still")));
    await whilePointerPressed(() => undefined);
    expect(onChange).not.toHaveBeenCalled();
    expect(commits).toEqual([]);
    expect(valueNow("Still")).toBe(40);
  });

  it("commits once for a press on the track", async () => {
    const commits: number[] = [];
    renderSlider(
      <div style={{ width: 400 }}>
        <Slider label="Press" defaultValue={0} onValueCommitted={(value) => commits.push(value)} />
      </div>
    );
    const control = controlOf("Press");
    const box = control.getBoundingClientRect();
    await userEvent.click(page.elementLocator(control), {
      position: { x: box.width * 0.25, y: box.height / 2 },
    });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toBeGreaterThanOrEqual(23);
    expect(commits[0]).toBeLessThanOrEqual(27);
  });

  it("commits each key press with the value it reached", async () => {
    const commits: number[] = [];
    renderSlider(<Slider label="Size" defaultValue={50} onValueCommitted={(value) => commits.push(value)} />);
    sliderNamed("Size").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{Home}");
    expect(commits).toEqual([51, 52, 0]);
  });
});

describe("Slider density", () => {
  it("takes the md control height at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderSlider(<Slider label={`Height ${density}`} defaultValue={50} />);
      expect(px(getComputedStyle(controlOf(`Height ${density}`)).height), density).toBe(
        CONTROL_MD[density].height
      );
      unmount();
    }
  });

  it("fills a 240px-tall parent below its label row when vertical, at both densities", async () => {
    for (const density of DENSITIES) {
      const label = `Bass ${density}`;
      stampDensity(density);
      const { unmount } = renderSlider(
        <div data-testid="parent" style={{ height: 240 }}>
          <Slider label={label} orientation="vertical" defaultValue={50} />
        </div>
      );
      const parentBottom = page.getByTestId("parent").element().getBoundingClientRect().bottom;
      expect(
        Math.abs(controlOf(label).getBoundingClientRect().bottom - parentBottom),
        density
      ).toBeLessThanOrEqual(1);

      const thumbTop = thumbOf(label).getBoundingClientRect().top;
      sliderNamed(label).focus();
      await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}");
      expect(valueNow(label), density).toBe(55);
      expect(thumbOf(label).getBoundingClientRect().top, density).toBeLessThan(thumbTop);
      unmount();
    }
  });

  // A host without preflight leaves `content-box` in place, and a host may set a root font
  // under 16px: the thumb paints 16px and keeps a 24px target centred on it either way.
  it.each(["content-box", "border-box"] as const)(
    "paints a 16px thumb with a centred 24px target under %s, at a 14px or 16px root and both densities",
    (boxSizing) => {
      const sizing = document.createElement("style");
      sizing.textContent = `*, ::before, ::after { box-sizing: ${boxSizing}; }`;
      document.head.append(sizing);
      try {
        for (const rootFont of ["16px", "14px"]) {
          document.documentElement.style.fontSize = rootFont;
          for (const density of DENSITIES) {
            const label = `Target ${density} ${rootFont}`;
            stampDensity(density);
            const { unmount } = renderSlider(
              <div style={{ width: 400, padding: 24 }}>
                <Slider label={label} defaultValue={50} />
              </div>
            );
            const thumb = thumbOf(label);
            const box = thumb.getBoundingClientRect();
            expect([box.width, box.height], label).toEqual([16, 16]);

            const centreX = box.left + box.width / 2;
            const centreY = box.top + box.height / 2;
            // The sampled corners sit half a pixel inside the 24px square.
            const reach = 24 / 2 - 0.5;
            for (const [dx, dy] of [
              [-reach, -reach],
              [reach, -reach],
              [-reach, reach],
              [reach, reach],
            ] as const) {
              const hit = document.elementFromPoint(centreX + dx, centreY + dy);
              expect(
                hit === thumb || (hit instanceof Node && thumb.contains(hit)),
                `${label} ${dx},${dy}`
              ).toBe(true);
            }
            unmount();
          }
        }
      } finally {
        sizing.remove();
      }
    }
  );
});

/**
 * The reset listener's plumbing is proved in `use-form-reset.browser.test.tsx`. Slider
 * remounts its base-ui root on reset, as NumberField does, so these cases prove the remount
 * restores the uncontrolled value and what the form submits, and keeps focus on its thumb.
 */
describe("Slider native form reset", () => {
  it("restores an uncontrolled value on native reset, and submits it", async () => {
    const onChange = vi.fn();
    renderSlider(
      <form aria-label="Volume form">
        <Slider label="Volume" name="volume" defaultValue={30} onChange={onChange} />
      </form>
    );
    sliderNamed("Volume").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(valueNow("Volume")).toBe(32);
    const edits = onChange.mock.calls.length;

    formNamed("Volume form").reset();

    await expect.poll(() => valueNow("Volume")).toBe(30);
    expect(document.activeElement, "the remount keeps focus on the thumb").toBe(sliderNamed("Volume"));
    expect(onChange, "native reset does not call onChange").toHaveBeenCalledTimes(edits);
    expect(new FormData(formNamed("Volume form")).getAll("volume")).toEqual(["30"]);
  });

  it("restores an uncontrolled range on native reset, and keeps focus on the thumb that held it", async () => {
    renderSlider(
      <form aria-label="Price form">
        <Slider label="Price" name="price" defaultValue={[20, 80]} />
      </form>
    );
    sliderNamed("Price, maximum").focus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(valueNow("Price, maximum")).toBe(77);

    formNamed("Price form").reset();

    await expect.poll(() => valueNow("Price, maximum")).toBe(80);
    expect(valueNow("Price, minimum")).toBe(20);
    expect(document.activeElement).toBe(sliderNamed("Price, maximum"));
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
    renderSlider(<ControlledVolume />);
    sliderNamed("Volume").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(valueNow("Volume")).toBe(32);
    sliderNamed("Balance").focus();
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
    sliderNamed("Price, maximum").focus();
    rerender(price(50));

    formNamed("Price form").reset();

    await expect.poll(() => valueNow("Price")).toBe(50);
    expect(document.activeElement, "focus moves to the one thumb left").toBe(sliderNamed("Price"));

    await userEvent.keyboard("{ArrowRight}");
    expect(valueNow("Price")).toBe(51);
    formNamed("Price form").reset();

    await expect.poll(() => valueNow("Price")).toBe(50);
    expect(document.activeElement).toBe(sliderNamed("Price"));
    expect(new FormData(formNamed("Price form")).getAll("price")).toEqual(["50"]);
  });
});

/**
 * Attribute writes on a thumb's range input while the value moves: Fuse marks the input once
 * when it attaches, so moving the thumb writes nothing to it.
 */
describe("Slider thumb input attributes", () => {
  it("marks each thumb input once, not on every value change", async () => {
    renderSlider(<Slider label="Size" defaultValue={10} />);
    const input = sliderNamed("Size");
    expect(input.hasAttribute("data-focus-ring-control")).toBe(true);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((delivered) => {
      records.push(...delivered);
    });
    observer.observe(input, { attributes: true, attributeFilter: ["data-focus-ring-control"] });

    input.focus();
    await userEvent.keyboard("{ArrowRight}".repeat(10));
    expect(input.getAttribute("aria-valuenow")).toBe("20");
    records.push(...observer.takeRecords());
    observer.disconnect();
    expect(records).toHaveLength(0);
  });
});
