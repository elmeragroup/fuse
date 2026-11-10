import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  querySlot,
  renderInvoice,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

describe("SkeletonReveal", () => {
  it("is busy and labelled while loading, keeps the skeleton from assistive tech and the keyboard, and reaches the content only once it is shown", async () => {
    const { show } = renderInvoice(null);
    const root = slot("skeleton-reveal");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(slot("skeleton-reveal-label").textContent).toBe("Henter faktura");
    const skeleton = slot("skeleton-reveal-skeleton");
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.inert).toBe(true);

    // The ghost renders the sample's real Button, which is neither named to assistive tech nor focusable.
    expect(page.getByRole("button").query()).toBeNull();
    const ghostButton = skeleton.querySelector("button");
    expect(ghostButton).toBeInstanceOf(HTMLButtonElement);
    ghostButton?.focus();
    expect(document.activeElement).not.toBe(ghostButton);

    show(LONG);
    expect(root.getAttribute("aria-busy")).toBe("false");
    expect(querySlot("skeleton-reveal-label")).toBeNull();
    const pay = roleNamed("button", "Pay Invoice 4711");
    pay.focus();
    expect(document.activeElement).toBe(pay);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});

describe("SkeletonReveal smart hold", () => {
  it("shows a held skeleton once the hold passes, and calls onReveal once the content is in", async () => {
    let revealed = 0;
    function Slow({ data }: { data: Invoice | null }) {
      return (
        <SkeletonReveal data={data} sample={SAMPLE} label="Henter" onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      );
    }
    const { rerender } = renderThemed(<Slow data={null} />);
    const skeleton = slot("skeleton-reveal-skeleton");
    await expect.poll(() => getComputedStyle(skeleton).opacity, { timeout: 2000 }).toBe("1");
    rerender(<Slow data={LONG} />);
    expect(revealed).toBe(0);
    await expect.poll(() => revealed, { timeout: 2000 }).toBe(1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});
