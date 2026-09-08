# Phone reset reproduction source

This is the transient probe used on 2026-09-08 against commit `f14057be`. Its two expected failures are recorded in [the investigation result](/Users/tommy.lunde.barvag/src/work/elmera/ui/plans/probes/phone-reset-result.md). The source is archived as text so it does not add an intentionally failing suite or temporary configuration to ordinary repository checks.

To repeat the original investigation, recreate the following two files under `plans/probes/` from these text blocks, then run the command in the result document. Delete only those recreated transient files after the run. An implementation should instead add the regression to the normal in-package test suite as specified by plan 011.

## plans/probes/phone-reset.vitest.config.mjs

```text
import { fileURLToPath } from "node:url";
import base from "../../packages/ui/vitest.config.ts";

const browser = base.test.projects.find((project) => project.test.name === "browser");
export default {
  root: fileURLToPath(new URL("../../packages/ui/", import.meta.url)),
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    ...base.test,
    projects: [
      {
        ...browser,
        resolve: { dedupe: ["react", "react-dom"] },
        test: {
          ...browser.test,
          include: [
            "src/components/phone-number-field/phone-state.browser.test.tsx",
            "../../plans/probes/phone-reset.browser.test.ts",
          ],
        },
      },
    ],
  },
};
```

## plans/probes/phone-reset.browser.test.ts

```text
import { createElement as h } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { PhoneNumberField } from "../../packages/ui/src/phone-number-field";
import { withLocale } from "../../packages/ui/test/locale-matrix";
import { renderThemed, roleNamed } from "../../packages/ui/test/themed-browser-render";

function form(): HTMLFormElement {
  const element = roleNamed("form", "Reset probe");
  if (!(element instanceof HTMLFormElement)) throw new Error("Expected probe form");
  return element;
}

function input(): HTMLInputElement {
  const element = roleNamed("textbox", "Mobile");
  if (!(element instanceof HTMLInputElement)) throw new Error("Expected phone input");
  return element;
}

function snapshot() {
  return {
    display: input().value,
    submitted: new FormData(form()).get("phone"),
    submittedDisplay: new FormData(form()).get("phone-display-value"),
  };
}

function mount({ controlled = false, cancelReset = false } = {}) {
  const change = vi.fn();
  renderThemed(withLocale("en-US", h("form", {
    "aria-label": "Reset probe",
    onReset: cancelReset ? (event) => event.preventDefault() : undefined,
  },
  h(PhoneNumberField, { label: "Mobile", name: "phone", onChange: change,
    ...(controlled ? { value: "+4741234567" } : {}),
  }),
  h("button", { type: "reset" }, "Reset phone"))));
  return change;
}

const populated = { display: "41234567", submitted: "+4741234567", submittedDisplay: "41234567" };
const empty = { display: "", submitted: "", submittedDisplay: "" };

describe("PhoneNumberField native reset investigation", () => {
  it("baseline: uncontrolled editing updates display and actual FormData", async () => {
    const change = mount();
    expect(snapshot()).toEqual(empty);
    await userEvent.fill(input(), "41234567");
    expect(snapshot()).toEqual(populated);
    expect(change).toHaveBeenLastCalledWith("+4741234567");
  });

  it.each(["method", "button"])("regression: uncontrolled %s reset restores initially empty state", async (mode) => {
    mount();
    expect(snapshot()).toEqual(empty);
    await userEvent.fill(input(), "41234567");
    expect(snapshot()).toEqual(populated);
    if (mode === "method") form().reset();
    else await userEvent.click(roleNamed("button", "Reset phone"));
    // Allow native reset default action and any queued component reset handling to finish.
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log(`PHONE_RESET_${mode}`, JSON.stringify(snapshot()));
    expect(snapshot()).toEqual(empty);
  });

  it("sanity: a cancelled native reset preserves the uncontrolled value", async () => {
    mount({ cancelReset: true });
    await userEvent.fill(input(), "41234567");
    form().reset();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(snapshot()).toEqual(populated);
  });

  it("sanity: controlled reset preserves the authoritative parent value", async () => {
    mount({ controlled: true });
    expect(snapshot()).toEqual(populated);
    form().reset();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(snapshot()).toEqual(populated);
  });
});
```
