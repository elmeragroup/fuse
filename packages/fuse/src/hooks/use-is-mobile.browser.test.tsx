import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { useIsMobile } from "./use-is-mobile";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function Probe({ onRender }: { onRender: (isMobile: boolean) => void }) {
  const isMobile = useIsMobile();
  onRender(isMobile);
  return <output aria-label="Viewport">{isMobile ? "mobile" : "desktop"}</output>;
}

function viewportStatus() {
  return page.getByRole("status", { name: "Viewport", exact: true });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1024, 768);
});

describe("useIsMobile", () => {
  it("reads mql.matches on the first client render below the breakpoint", async () => {
    await page.viewport(767, 800);
    expect(window.matchMedia(MOBILE_MEDIA_QUERY).matches).toBe(true);
    const seen: boolean[] = [];
    render(
      <Probe
        onRender={(value) => {
          seen.push(value);
        }}
      />
    );
    expect(seen[0]).toBe(true);
    expect(seen).not.toContain(false);
    await expect.element(viewportStatus()).toHaveTextContent("mobile");
  });

  it("reads mql.matches on the first client render at the breakpoint", async () => {
    await page.viewport(768, 800);
    expect(window.matchMedia(MOBILE_MEDIA_QUERY).matches).toBe(false);
    const seen: boolean[] = [];
    render(
      <Probe
        onRender={(value) => {
          seen.push(value);
        }}
      />
    );
    expect(seen[0]).toBe(false);
    await expect.element(viewportStatus()).toHaveTextContent("desktop");
  });

  it("re-renders on MQL change events in both directions and stops after unmount", async () => {
    await page.viewport(1024, 768);
    const seen: boolean[] = [];
    const { unmount } = render(
      <Probe
        onRender={(value) => {
          seen.push(value);
        }}
      />
    );
    expect(seen.at(-1)).toBe(false);

    await page.viewport(500, 800);
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(true);
    });
    await expect.element(viewportStatus()).toHaveTextContent("mobile");

    await page.viewport(1024, 768);
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(false);
    });
    await expect.element(viewportStatus()).toHaveTextContent("desktop");

    const removeListener = vi.spyOn(MediaQueryList.prototype, "removeEventListener");
    unmount();
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
