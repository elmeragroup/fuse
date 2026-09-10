import { expect, it } from "vitest";

import { renderThemed } from "../../../test/themed-browser-render";
import { useNumericTextField } from "./use-numeric-text-field";
import type { NumericTextFieldResult } from "./use-numeric-text-field";

it.each([undefined, "123"] as const)(
  "exposes onReset only when the numeric value is uncontrolled: %s",
  (value) => {
    let numeric: NumericTextFieldResult | undefined;

    function Probe() {
      numeric = useNumericTextField({
        filter: "numeric",
        value,
        defaultValue: "123",
        onChange: undefined,
      });
      return <input value={numeric.value} readOnly />;
    }

    renderThemed(<Probe />);
    if (value === undefined) {
      expect(numeric?.onReset).toBeTypeOf("function");
    } else {
      expect(numeric?.onReset).toBeNull();
    }
  }
);
