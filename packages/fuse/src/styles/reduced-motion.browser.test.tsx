/**
 * Unit under test: the central `prefers-reduced-motion: reduce` rule in `fuse.css`.
 * Oracle: the CSS Transitions list-matching rule. A property at index i of `transition-property`
 * takes the duration and delay at index i modulo each list's length, so the expected values below
 * are worked out by hand from the lists each element declares.
 */
import { afterEach, describe, expect, it } from "vitest";

import "../../dist/styles.css";
import { render } from "../../test/browser-render";
import { emulateReducedMotion } from "../../test/reduced-motion";

/** A chart part authored as the rule's comment asks: movement and its delay sit under no-preference. */
const AUTHORED = `
[data-probe="authored"] { transition: opacity 160ms ease; }
@media (prefers-reduced-motion: no-preference) {
  [data-probe="authored"] { transition: opacity 160ms ease, transform 560ms ease 96ms; }
}
`;

/** One entry of a computed transition list per property, as `getComputedStyle` writes it. */
function entries(list: string): string[] {
  return list.split(",").map((entry) => entry.trim());
}

/** The duration and delay one transition property takes. */
type Timing = { readonly duration: string; readonly delay: string };

/** The two probe elements. */
type Probes = { readonly authored: Element; readonly staggered: Element };

/** The duration and delay one property takes, by the list-matching rule. */
function timingOf(element: Element, property: string): Timing {
  const style = getComputedStyle(element);
  const properties = entries(style.transitionProperty);
  const durations = entries(style.transitionDuration);
  const delays = entries(style.transitionDelay);
  const index = properties.indexOf(property);
  if (index === -1) {
    throw new Error(`${property} is not in ${style.transitionProperty}`);
  }
  return { duration: durations[index % durations.length] ?? "", delay: delays[index % delays.length] ?? "" };
}

describe("the central reduced-motion rule", () => {
  let sheet: HTMLStyleElement | undefined;

  afterEach(async () => {
    sheet?.remove();
    await emulateReducedMotion("no-preference");
  });

  function renderProbes(): Probes {
    sheet = document.createElement("style");
    sheet.textContent = AUTHORED;
    document.head.append(sheet);
    const { host } = render(
      <>
        <div data-probe="authored" />
        <div
          data-probe="staggered"
          style={{
            transition: "opacity 160ms ease 48ms, transform 560ms ease 96ms",
            "--animate-chart-ping": "chart-ping 1s infinite",
          }}
        />
      </>
    );
    const authored = host.querySelector('[data-probe="authored"]');
    const staggered = host.querySelector('[data-probe="staggered"]');
    if (authored === null || staggered === null) {
      throw new Error("the probes did not render");
    }
    return { authored, staggered };
  }

  it("keeps the movement and the stagger with no preference", () => {
    const { authored } = renderProbes();
    expect(timingOf(authored, "transform")).toEqual({ duration: "0.56s", delay: "0.096s" });
  });

  it("drops movement, keeps an authored fade at its own duration and starts it at once", async () => {
    const { authored } = renderProbes();
    await emulateReducedMotion("reduce");
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(entries(getComputedStyle(authored).transitionProperty)).not.toContain("transform");
    expect(timingOf(authored, "opacity")).toEqual({ duration: "0.16s", delay: "0s" });
    expect(timingOf(authored, "background-color")).toEqual({ duration: "0.16s", delay: "0s" });
  });

  it("resets every delay, so no fade waits on a stagger meant for movement", async () => {
    const { staggered } = renderProbes();
    await emulateReducedMotion("reduce");
    expect(entries(getComputedStyle(staggered).transitionDelay)).toEqual(["0s"]);
    expect(timingOf(staggered, "opacity").delay).toBe("0s");
  });

  it("turns the chart keyframe animations off over an inline value", async () => {
    const { staggered } = renderProbes();
    expect(getComputedStyle(staggered).getPropertyValue("--animate-chart-ping").trim()).toBe(
      "chart-ping 1s infinite"
    );
    await emulateReducedMotion("reduce");
    for (const name of ["--animate-chart-ping", "--animate-chart-dash", "--animate-chart-shimmer"]) {
      expect(getComputedStyle(staggered).getPropertyValue(name).trim(), name).toBe("none");
    }
  });
});
