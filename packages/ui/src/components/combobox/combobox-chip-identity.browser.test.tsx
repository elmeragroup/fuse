import { StrictMode, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { Combobox } from "@elmeragroup/ui/combobox";

import { render } from "../../../test/browser-render";
import { withLocale } from "../../../test/locale-matrix";
import { roleNamed } from "../../../test/themed-browser-render";

const options = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];
type Option = (typeof options)[number];

function RefreshingChip({ item, removeLabel }: { item: Option; removeLabel?: string }) {
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setRefresh(refresh + 1)}>
        Refresh {item.name}
      </button>
      <Combobox.Chip removeLabel={removeLabel}>
        <span data-refresh={refresh}>{item.name}</span>
      </Combobox.Chip>
    </>
  );
}

describe("Combobox chip item identity", () => {
  it.each([false, true])(
    "pairs object labels and removal after isolated rerender and reorder, StrictMode: %s",
    async (strict) => {
      const changed = vi.fn<(values: Option[]) => void>();
      function Parent() {
        const [selected, setSelected] = useState(options);
        return (
          <>
            <button type="button" onClick={() => setSelected([...selected].reverse())}>
              Reorder
            </button>
            <output aria-label="Selected items">{selected.map((item) => item.id).join(",")}</output>
            <Combobox.Root
              multiple
              items={options}
              value={selected}
              onValueChange={(next) => {
                changed(next);
                setSelected(next);
              }}
              itemToStringLabel={(item) => item.name}>
              <Combobox.Chips>
                <Combobox.Value>
                  {(values: Option[]) => values.map((item) => <RefreshingChip key={item.id} item={item} />)}
                </Combobox.Value>
                <Combobox.ChipsInput aria-label="People" />
              </Combobox.Chips>
            </Combobox.Root>
          </>
        );
      }
      render(
        withLocale(
          "en-US",
          strict ? (
            <StrictMode>
              <Parent />
            </StrictMode>
          ) : (
            <Parent />
          )
        )
      );
      expect(roleNamed("button", "Remove Alpha")).toBeTruthy();
      expect(roleNamed("button", "Remove Beta")).toBeTruthy();
      await userEvent.click(roleNamed("button", "Refresh Alpha"));
      expect(roleNamed("button", "Remove Alpha")).toBeTruthy();
      expect(roleNamed("button", "Remove Beta")).toBeTruthy();
      await userEvent.click(roleNamed("button", "Reorder"));
      expect(roleNamed("status", "Selected items").textContent).toBe("b,a");
      await userEvent.click(roleNamed("button", "Remove Alpha"));
      expect(changed).toHaveBeenLastCalledWith([options[1]]);
      expect(roleNamed("status", "Selected items").textContent).toBe("b");
      expect(roleNamed("button", "Remove Beta")).toBeTruthy();
      await userEvent.click(roleNamed("button", "Remove Beta"));
      expect(changed).toHaveBeenLastCalledWith([]);
      expect(roleNamed("status", "Selected items").textContent).toBe("");
    }
  );

  it("preserves explicit removal labels for uncontrolled object selections", async () => {
    const changed = vi.fn<(values: Option[]) => void>();
    render(
      withLocale(
        "en-US",
        <StrictMode>
          <Combobox.Root
            multiple
            defaultValue={options}
            items={options}
            itemToStringLabel={(item) => item.name}
            onValueChange={(next) => changed(next)}>
            <Combobox.Chips>
              <Combobox.Value>
                {(values: Option[]) =>
                  values.map((item) => (
                    <RefreshingChip
                      key={item.id}
                      item={item}
                      removeLabel={item.id === "a" ? "Discard first person" : undefined}
                    />
                  ))
                }
              </Combobox.Value>
            </Combobox.Chips>
          </Combobox.Root>
        </StrictMode>
      )
    );
    await userEvent.click(roleNamed("button", "Refresh Alpha"));
    await userEvent.click(roleNamed("button", "Discard first person"));
    expect(changed).toHaveBeenLastCalledWith([options[1]]);
    expect(roleNamed("button", "Remove Beta")).toBeTruthy();
    await userEvent.click(roleNamed("button", "Remove Beta"));
    expect(changed).toHaveBeenLastCalledWith([]);
  });
});
