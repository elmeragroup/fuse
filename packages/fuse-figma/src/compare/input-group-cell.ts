/**
 * The renderer of the `input-group` set: each cell as the real Fuse parts Combobox and Command
 * render, in a host as wide as the kit's preview width, in static markup, since none of them
 * portals anything while closed.
 *
 * - `form=caret` renders `<Combobox.Input>` in a `Combobox.Root`, and `form=clear` renders it with
 *   `showClear` and no trigger in a `multiple` root holding one selection, which Base UI shows the
 *   clear button for while the input stays empty. Each passes `w-full`, which replaces Combobox's
 *   `w-auto`: the set draws `InputGroup.Root` as it is, and the composites that hold it pass
 *   Combobox's own classes.
 * - `form=caret open` renders `form=caret` in a `defaultOpen` root, so Base UI stamps the caret trigger
 *   open. The popup portals in an effect, which static markup never runs, so the cell shows the input
 *   alone.
 * - `form=search` renders the parts `Command.Input` composes, `InputGroup.Root` around an
 *   `InputGroup.Input` and an `InputGroup.Addon` holding MagnifyingGlass, without Command's own
 *   slot and classes, which the composites pass.
 * - Every cell shows the placeholder `input-group-kit.ts` draws. `disabled` disables the input and
 *   the Combobox, which disables its buttons too, and `invalid` wraps the group in an invalid
 *   `Field.Root`, which marks the input, and Combobox's caret, `aria-invalid` and `data-invalid`.
 * - Combobox reads its labels from `LocaleProvider`, which throws without one, so every cell renders
 *   in `en-US`, the locale the docs set.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Combobox } from "../../../fuse/dist/combobox.js";
import { Field } from "../../../fuse/dist/field.js";
import { MagnifyingGlass } from "../../../fuse/dist/icons.js";
import { InputGroup } from "../../../fuse/dist/input-group.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/field-box-kit.ts";
import { INPUT_GROUP_TEXT } from "../components/input-group-text.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The items of the Combobox around a `caret` or `clear` cell. */
const ITEMS = ["Apple", "Banana"];

/** The group a cell's form renders. */
function group(cell: Cell): ReactElement {
  const disabled = cell.state === "disabled";
  if (cell.form === "search") {
    return createElement(
      InputGroup.Root,
      null,
      createElement(InputGroup.Input, { placeholder: INPUT_GROUP_TEXT, disabled }),
      createElement(InputGroup.Addon, null, createElement(MagnifyingGlass))
    );
  }
  const input = { "aria-label": "Fruit", placeholder: INPUT_GROUP_TEXT, className: "w-full", disabled };
  if (cell.form === "clear") {
    return createElement(
      Combobox.Root,
      { items: ITEMS, disabled, multiple: true, defaultValue: [ITEMS[0]] },
      createElement(Combobox.Input, { ...input, showClear: true, showTrigger: false })
    );
  }
  // `form=caret open` opens the Combobox, whose popup portals nowhere in static markup.
  const defaultOpen = cell.form === "caret open";
  return createElement(
    Combobox.Root,
    { items: ITEMS, disabled, defaultOpen },
    createElement(Combobox.Input, input)
  );
}

/** An `input-group` cell: a form of the group, at rest, disabled or inside an invalid Field. */
export const inputGroup: CellRendering = {
  element: (cell: Cell) =>
    createElement(LocaleProvider, {
      locale: "en-US",
      children: createElement(
        "div",
        { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
        cell.state === "invalid" ? createElement(Field.Root, { invalid: true }, group(cell)) : group(cell)
      ),
    }),
};
