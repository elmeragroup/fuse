import { describe, expect, it } from "vitest";

import "../dist/styles.css";
// Role tokens live in themes.css only; styles.css defines none of them.
import "../dist/themes.css";
import { render } from "../test/browser-render";
import {
  cssVarColor,
  fkasExternal,
  headingNamed,
  renderThemed,
  roleNamed,
  textboxNamed,
} from "../test/themed-browser-render";
import { ThemeScope } from "./theme/theme-scope";

describe("roleNamed", () => {
  it("finds an element by role and exact accessible name", () => {
    renderThemed(
      <div>
        <button type="button">Send meter reading</button>
        <button type="button">Send</button>
      </div>
    );

    expect(roleNamed("button", "Send").textContent).toBe("Send");
    expect(roleNamed("button", "Send meter reading").textContent).toBe("Send meter reading");
  });

  it("throws when no element carries that role and name", () => {
    renderThemed(<button type="button">Send</button>);

    expect(() => roleNamed("button", "Cancel")).toThrow();
  });

  it("backs textboxNamed", () => {
    renderThemed(
      <label>
        Meter number
        <input type="text" />
      </label>
    );

    expect(textboxNamed("Meter number")).toBe(roleNamed("textbox", "Meter number"));
  });
});

describe("headingNamed", () => {
  it("discriminates on heading level", () => {
    renderThemed(
      <div>
        <h2>Order overview</h2>
        <h3>Order overview</h3>
      </div>
    );

    expect(headingNamed("Order overview", 2).tagName).toBe("H2");
    expect(headingNamed("Order overview", 3).tagName).toBe("H3");
  });

  it("throws when the level does not match", () => {
    renderThemed(<h2>Order overview</h2>);

    expect(() => headingNamed("Order overview", 3)).toThrow();
  });
});

describe("cssVarColor", () => {
  it("reads a role token that differs between the internal and external fkas themes", () => {
    renderThemed(<h2>internal primary</h2>);
    const internal = cssVarColor(headingNamed("internal primary", 2), "--primary");

    render(
      <ThemeScope theme={fkasExternal}>
        <h2>external primary</h2>
      </ThemeScope>
    );
    const externalHeading = headingNamed("external primary", 2);
    const external = cssVarColor(externalHeading, "--primary");

    // themes.css: internal --primary is the neutral near-black, external-fkas is Fjordkraft orange.
    expect(internal).toBe("oklch(0.16 0 0)");
    expect(external).toBe("oklch(0.4848 0.16637 35.92)");
    // Fjordkraft's external --primary is its orange; currentColor, the fallback an undefined var
    // leaves behind, would be the black the document inherits.
    expect(external).not.toBe(getComputedStyle(externalHeading).color);
  });

  it("throws on the renderThemed host, which sits outside the ThemeScope", () => {
    const { host } = renderThemed(<h2>inside</h2>);

    // :root declares a --primary, so the host silently reads the internal default rather than the
    // scope's value; the guard is on the ThemeScope boundary, not on the token being defined.
    expect(getComputedStyle(host).getPropertyValue("--primary").trim()).not.toBe("");
    expect(() => cssVarColor(host, "--primary")).toThrow(/needs an element under a ThemeScope/);
  });
});
