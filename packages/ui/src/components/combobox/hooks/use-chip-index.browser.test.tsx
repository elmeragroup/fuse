import { memo, StrictMode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderThemed as render } from "../../../../test/themed-browser-render";
import { ChipIndexCommit, ChipIndexContext, createChipIndexRegistry, useChipIndex } from "./use-chip-index";

const Chip = memo(function Chip() {
  const { ref, index } = useChipIndex();
  return (
    <div ref={ref} data-measure-chip="">
      {index}
    </div>
  );
});

describe("chip registry commits", () => {
  it.each([false, true])("batches mounting and added chips before paint, StrictMode: %s", (strict) => {
    const registry = createChipIndexRegistry();
    const selected = Array.from({ length: 100 }, (_, index) => String(index));
    const sorts = vi.spyOn(Array.prototype, "sort");
    const sortSizes = () =>
      sorts.mock.contexts
        .filter(
          (context): context is HTMLElement[] =>
            Array.isArray(context) &&
            context.length > 0 &&
            context.every((node) => node instanceof HTMLElement && node.hasAttribute("data-measure-chip"))
        )
        .map((context) => context.length);
    function Host({ count }: { count: number }) {
      return (
        <ChipIndexContext.Provider value={registry}>
          <ChipIndexCommit selected={selected} />
          {selected.slice(0, count).map((id) => (
            <Chip key={id} />
          ))}
        </ChipIndexContext.Provider>
      );
    }
    const tree = (count: number) =>
      strict ? (
        <StrictMode>
          <Host count={count} />
        </StrictMode>
      ) : (
        <Host count={count} />
      );
    try {
      const { host, rerender } = render(tree(50));
      expect(sortSizes()).toEqual([50]);
      expect([...host.querySelectorAll("[data-measure-chip]")].map((node) => node.textContent)).toEqual(
        selected.slice(0, 50)
      );
      sorts.mockClear();
      rerender(tree(100));
      expect(sortSizes()).toEqual([100]);
      expect([...host.querySelectorAll("[data-measure-chip]")].map((node) => node.textContent)).toEqual(
        selected
      );
      sorts.mockClear();
      rerender(tree(100));
      expect(sortSizes()).toEqual([]);
      rerender(tree(30));
      expect(sortSizes()).toEqual([30]);
      expect([...host.querySelectorAll("[data-measure-chip]")].map((node) => node.textContent)).toEqual(
        selected.slice(0, 30)
      );
    } finally {
      sorts.mockRestore();
    }
  });
});
