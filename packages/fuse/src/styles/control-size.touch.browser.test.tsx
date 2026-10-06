import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../dist/styles.css";
import { withLocale } from "../../test/locale-matrix";
import {
  CONTROL_MD,
  FIXED_CONTROL_TYPE,
  normalLineHeightOf,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../test/themed-browser-render";
import { Combobox } from "../components/combobox";
import { InputGroup } from "../components/input-group";
import { Input } from "../components/input/input";
import { NumberField } from "../components/number-field/number-field";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { TextField } from "../components/text-field/text-field";
import { Textarea } from "../components/textarea/textarea";
import { DateField } from "../react-aria/date-field/date-field";
import { SearchField } from "../react-aria/search-field/search-field";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";

/**
 * Control size under a coarse pointer: the 16px type floor on every text-entry box, at both
 * densities. The oracle is `CONTROL_MD` and `FIXED_CONTROL_TYPE` from the shared harness, as
 * in `control-size.browser.test.tsx`.
 *
 * Touch emulation is page-wide, so this file runs in the `browser-touch` project: in the
 * parallel `browser` project it would switch off `(hover: hover)` for neighbouring files.
 */

const DENSITIES = ["dense", "comfortable"] as const;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

/** iOS Safari zooms into a focused editable field whose text is under 16px. */
const IOS_NO_ZOOM_FONT = 16;

type TouchEmulationCdp = {
  send: (
    method: "Emulation.setTouchEmulationEnabled",
    params: { enabled: boolean; maxTouchPoints?: number }
  ) => Promise<void>;
};

/** Chromium's touch emulation, which also switches `(pointer: coarse)` on and off. */
async function emulatePointer(pointer: "fine" | "coarse"): Promise<void> {
  // SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
  const session = cdp() as TouchEmulationCdp;
  await session.send(
    "Emulation.setTouchEmulationEnabled",
    pointer === "coarse" ? { enabled: true, maxTouchPoints: 1 } : { enabled: false }
  );
  expect(matchMedia("(pointer: coarse)").matches, `${pointer} pointer emulated`).toBe(pointer === "coarse");
}

function firstSegmentOf(groupName: string): HTMLElement {
  const segment = roleNamed("group", groupName).querySelector<HTMLElement>("[role='spinbutton']");
  if (segment === null) {
    throw new Error(`expected a date segment in ${groupName}`);
  }
  return segment;
}

describe("control size: the text-entry touch floor", () => {
  afterEach(async () => {
    await emulatePointer("fine");
  });

  const POINTERS = ["fine", "coarse"] as const;
  const CASES = DENSITIES.flatMap((density) => POINTERS.map((pointer) => [density, pointer] as const));

  function renderEntryBoxes(): void {
    renderThemed(
      withLocale(
        "en-US",
        <UiProviders locale="en-US" navigate={() => undefined}>
          <Input aria-label="entry input" />
          <Textarea aria-label="entry textarea" />
          <InputGroup.Root>
            <InputGroup.Input aria-label="entry group input" />
          </InputGroup.Root>
          <TextField label="entry text field" />
          <NumberField label="entry number" />
          <PhoneNumberField label="entry phone" />
          <Combobox.Root items={["Apple"]}>
            <Combobox.Input aria-label="entry combobox" />
          </Combobox.Root>
          <SearchField label="entry search" />
          <DateField label="entry date" />
          <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
            <Combobox.Chips aria-label="entry chips">
              <Combobox.Chip removeLabel="Remove Apple">Apple</Combobox.Chip>
              <Combobox.ChipsInput aria-label="entry chips input" />
            </Combobox.Chips>
          </Combobox.Root>
          <TextField variant="card" label="entry card field" />
          <Input aria-label="entry small input" className="text-sm" />
        </UiProviders>
      )
    );
  }

  it.each(CASES)(
    "floors the density type of every md text-entry box at %s with a %s pointer",
    async (density, pointer) => {
      stampDensity(density);
      await emulatePointer(pointer);
      renderEntryBoxes();
      const md = CONTROL_MD[density];
      // The floor lifts dense 14px and leaves comfortable 18px; a fine pointer keeps the metric.
      const font = pointer === "coarse" ? Math.max(IOS_NO_ZOOM_FONT, md.font) : md.font;
      for (const element of [
        roleNamed("textbox", "entry input"),
        roleNamed("textbox", "entry textarea"),
        roleNamed("textbox", "entry group input"),
        roleNamed("textbox", "entry text field"),
        roleNamed("textbox", "entry number"),
        roleNamed("textbox", "entry phone"),
        roleNamed("combobox", "entry combobox"),
        roleNamed("searchbox", "entry search"),
        firstSegmentOf("entry date"),
      ]) {
        const label = `${density} ${pointer} ${element.getAttribute("aria-label") ?? element.id}`;
        const style = getComputedStyle(element);
        expect(px(style.fontSize), `${label} font`).toBe(font);
        expect(px(style.lineHeight), `${label} leading`).toBe(md.leading);
      }
      // Only the type moves: the box keeps the md rung, so the 16px glyphs fit the dense box.
      expect(
        px(getComputedStyle(roleNamed("textbox", "entry input")).height),
        `${density} ${pointer} input height`
      ).toBe(md.height);
    }
  );

  it.each(CASES)(
    "sets the phone dial code in its number's floored font size at normal leading at %s with a %s pointer",
    async (density, pointer) => {
      stampDensity(density);
      await emulatePointer(pointer);
      renderEntryBoxes();
      const md = CONTROL_MD[density];
      // The dial code lines up with the typed digits only while both have one size.
      const font = pointer === "coarse" ? Math.max(IOS_NO_ZOOM_FONT, md.font) : md.font;
      const trigger = roleNamed("button", "Select country");
      const dialCode = [...trigger.querySelectorAll("span")].find((span) => span.textContent === "+47");
      if (dialCode === undefined) {
        throw new Error("expected the +47 dial code on the country trigger");
      }
      expect(px(getComputedStyle(dialCode).fontSize), `${density} ${pointer} dial code font`).toBe(font);
      // Oracle: a plain block in the same font at `line-height: normal`.
      expect(dialCode.getBoundingClientRect().height, `${density} ${pointer} dial code leading`).toBe(
        normalLineHeightOf(dialCode)
      );
    }
  );

  it.each(CASES)(
    "floors the chips input over the chips box's 14px at %s with a %s pointer",
    async (density, pointer) => {
      stampDensity(density);
      await emulatePointer(pointer);
      renderEntryBoxes();
      const font = pointer === "coarse" ? IOS_NO_ZOOM_FONT : FIXED_CONTROL_TYPE.sm.font;
      expect(px(getComputedStyle(roleNamed("combobox", "entry chips input")).fontSize)).toBe(font);
    }
  );

  it.each(DENSITIES)("keeps the 16px floor under a 14px host root at %s", async (density) => {
    // WebKit's zoom threshold is a fixed 16px, so a root-relative floor would fall short here.
    document.documentElement.style.fontSize = "14px";
    try {
      stampDensity(density);
      await emulatePointer("coarse");
      renderEntryBoxes();
      for (const [role, name] of [
        ["textbox", "entry input"],
        ["combobox", "entry chips input"],
      ] as const) {
        expect(px(getComputedStyle(roleNamed(role, name)).fontSize), `${density} ${name}`).toBe(
          IOS_NO_ZOOM_FONT
        );
      }
    } finally {
      document.documentElement.style.removeProperty("font-size");
    }
  });

  it.each(CASES)(
    "lets a consumer font-size class replace the floor at %s with a %s pointer",
    async (density, pointer) => {
      stampDensity(density);
      await emulatePointer(pointer);
      renderEntryBoxes();
      // The card variant's `text-lg` is 1.125rem, 18px at the 16px root, on every pointer.
      expect(px(getComputedStyle(roleNamed("textbox", "entry card field")).fontSize)).toBe(18);
      // A consumer `text-sm` (14px) is an explicit size, so it stays below the floor on touch.
      expect(px(getComputedStyle(roleNamed("textbox", "entry small input")).fontSize)).toBe(
        FIXED_CONTROL_TYPE.sm.font
      );
    }
  );
});
