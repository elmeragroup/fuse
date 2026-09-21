import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Show } from "./show";

function hostNamed(name: string): HTMLElement {
  const element = page.getByRole("region", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a region named ${name}`);
  }
  return element;
}

describe("Show", () => {
  it("renders children when when is true", () => {
    renderThemed(
      <section aria-label="shown">
        <Show when={true}>
          <p>Visible result</p>
        </Show>
      </section>
    );
    const host = hostNamed("shown");
    expect(host.childElementCount).toBe(1);
    expect(host.firstElementChild?.tagName).toBe("P");
    expect(host.textContent).toBe("Visible result");
  });

  it("renders nothing when when is false", () => {
    renderThemed(
      <section aria-label="hidden">
        <Show when={false}>
          <p>Hidden result</p>
        </Show>
      </section>
    );
    const host = hostNamed("hidden");
    expect(host.childElementCount).toBe(0);
    expect(host.textContent).toBe("");
  });

  it("renders no wrapper element of its own", () => {
    renderThemed(
      <section aria-label="siblings">
        <Show when={true}>
          <p>First</p>
          <p>Second</p>
        </Show>
      </section>
    );
    const host = hostNamed("siblings");
    expect(host.childElementCount).toBe(2);
    expect([...host.children].map((child) => child.tagName)).toEqual(["P", "P"]);
    expect([...host.children].map((child) => child.textContent)).toEqual(["First", "Second"]);
  });
});
