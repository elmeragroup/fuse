import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../dist/styles.css";
import { render } from "../../test/browser-render";
import { useIsMobile } from "./use-is-mobile";

const MOBILE_MEDIA_QUERY = "(width < 48rem)";

function Probe({ onRender }: { onRender: (isMobile: boolean) => void }) {
  const isMobile = useIsMobile();
  onRender(isMobile);
  return (
    <>
      <output aria-label="Viewport">{isMobile ? "mobile" : "desktop"}</output>
      <div aria-label="md: probe" className="md:flex" role="group" />
    </>
  );
}

function viewportStatus() {
  return page.getByRole("status", { name: "Viewport", exact: true });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(1024, 768);
});

describe("useIsMobile", () => {
  it.each([
    { name: "below", width: 767, isMobile: true, text: "mobile", mdDisplay: "block" },
    { name: "at", width: 768, isMobile: false, text: "desktop", mdDisplay: "flex" },
  ])(
    "reads mql.matches on the first client render $name the breakpoint, where md: agrees",
    async ({ width, isMobile, text, mdDisplay }) => {
      await page.viewport(width, 800);
      expect(window.matchMedia(MOBILE_MEDIA_QUERY).matches).toBe(isMobile);
      const seen: boolean[] = [];
      render(
        <Probe
          onRender={(value) => {
            seen.push(value);
          }}
        />
      );
      expect(seen[0]).toBe(isMobile);
      expect(seen).not.toContain(!isMobile);
      await expect.element(viewportStatus()).toHaveTextContent(text);
      const mdProbe = page.getByRole("group", { name: "md: probe", exact: true }).element();
      expect(getComputedStyle(mdProbe).display).toBe(mdDisplay);
    }
  );

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

  it("queries the breakpoint in rem, as md: does, so both move with the browser's font size", () => {
    // Pass-through spy: matchMedia still answers, the spy only observes the query string. The
    // breakpoint table above holds at the default 16px font size, where 48rem and 768px agree.
    const queries: string[] = [];
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      queries.push(query);
      return matchMedia(query);
    });
    render(<Probe onRender={vi.fn()} />);
    expect(new Set(queries)).toEqual(new Set(["(width < 48rem)"]));
  });
});
