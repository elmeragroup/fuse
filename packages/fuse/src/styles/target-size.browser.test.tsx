import { describe, it } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { withLocale } from "../../test/locale-matrix";
import { atHostRoots, expectTargetBoxes, expectTargets } from "../../test/target-size";
import { renderThemed, roleNamed, stampDensity } from "../../test/themed-browser-render";
import { Button } from "../components/button/button";
import { Combobox } from "../components/combobox";
import { NumberField } from "../components/number-field/number-field";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { RadioGroup, RadioIconButton } from "../components/radio-group/radio-group";
import { Toggle } from "../components/toggle/toggle";
import { DENSITIES } from "../theme/density";

/**
 * Unit under test: the 24px target floor (WCAG 2.5.8) the control sizes own, on the smallest
 * targets Fuse draws: an icon-only inline Button, a NumberField's steppers inside the field box
 * and a Combobox chip's remove button, at both densities and at the 16px root and a 14px host root. Oracle: the
 * criterion's 24px square around each target's centre, which `test/target-size.ts` measures.
 */
describe("the 24px target floor", () => {
  it("holds for the smallest targets at both densities and both host roots", () => {
    renderThemed(
      withLocale(
        "en-US",
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 32,
            padding: 32,
          }}>
          <Button size="icon-inline" aria-label="Edit">
            ✎
          </Button>
          <NumberField aria-label="Amount" />
          <Combobox.Root multiple defaultValue={["Apple", "Banana"]}>
            <Combobox.Chips aria-label="Selected fruit">
              <Combobox.Chip>Apple</Combobox.Chip>
              <Combobox.Chip>Banana</Combobox.Chip>
              <Combobox.ChipsInput aria-label="Fruit" />
            </Combobox.Chips>
          </Combobox.Root>
        </div>
      )
    );
    const targets = [
      roleNamed("button", "Edit"),
      roleNamed("button", "Increase Amount"),
      roleNamed("button", "Decrease Amount"),
      roleNamed("button", "Remove Apple"),
      roleNamed("button", "Remove Banana"),
    ];
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectTargets(targets, `${density} ${String(root)}px`);
      }
    });
  });

  // A rounded square's corners fall outside its shape, so these targets meet the floor by their
  // box alone, the size `controlMetrics.xs` floors at 24px.
  it("holds for the boxes of the xs controls at both densities and both host roots", () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Button size="icon-xs" aria-label="Smallest button" />
          <Toggle size="xs" aria-label="Smallest toggle" />
          <RadioGroup label="Smallest">
            <RadioIconButton value="xxs" size="icon-xxs" aria-label="Smallest radio">
              <svg aria-hidden viewBox="0 0 1 1" />
            </RadioIconButton>
          </RadioGroup>
          <PhoneNumberField label="Phone" />
        </>
      )
    );
    const targets = [
      roleNamed("button", "Smallest button"),
      roleNamed("button", "Smallest toggle"),
      roleNamed("radio", "Smallest radio"),
      roleNamed("button", "+47 Norway"),
    ];
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectTargetBoxes(targets, `${density} ${String(root)}px`);
      }
    });
  });
});
