/**
 * Packed-entry gzip ceilings measured through consumer bundles with peers excluded.
 * Start new entries at measured × 1.5. Keep per-component and per-icon ceilings
 * fixed as weight grows unless a reviewed change explains the increase.
 * Shared entries, including styles.css and the root barrel, recalibrate to
 * measured × 1.5 when their measurement exceeds the standing ceiling.
 * When an entry shrinks, lower its ceiling by the bytes saved to retain headroom.
 */
import { FLAG_RAW_CEILING_BYTES } from "./flag-payload";

/** Date of the `measuredGzip` values recorded in the budget tables. */
export const BUDGETS_MEASURED_ON = "2026-09-19";

export type JsEntryBudget = {
  name: string;
  entryFile: string;
  measuredGzip: number;
  ceilingGzip: number;
};

export type NamedImportBudget = {
  name: string;
  entryFile: string;
  exportName: string;
  /**
   * The namespace members a route reads, such as `["Root", "Bar"]`. Without it the row keeps the
   * whole export.
   */
  members?: readonly string[];
  measuredGzip: number;
  ceilingGzip: number;
};

export type CssBudget = {
  name: string;
  file: string;
  measuredGzip: number;
  ceilingGzip: number;
};

export type FlagRawBudget = {
  name: string;
  ceilingBytes: number;
};

type MeasuredRow = { measuredGzip: number; ceilingGzip?: number };
type Measured<T> = Omit<T, "ceilingGzip"> & { ceilingGzip?: number };

export function ceilingFromMeasured(gzipBytes: number): number {
  return Math.round(gzipBytes * 1.5);
}

export function withDerivedCeiling<T extends MeasuredRow>(row: T): T & { ceilingGzip: number } {
  return { ...row, ceilingGzip: row.ceilingGzip ?? ceilingFromMeasured(row.measuredGzip) };
}

function derive<T extends MeasuredRow>(rows: readonly T[]): Array<T & { ceilingGzip: number }> {
  return rows.map(withDerivedCeiling);
}

// 2026-09-19: all rows re-measured against the pinned toolchain. Growth below a written ceiling
// keeps it; shrink ratchets it down by the saved bytes (scroll-area −73, illustrations −10,
// sidebar −76). Collapsible measures 27627 (+351), still under its standing ceiling — no shrink to
// record. The shared root barrel grew within its standing ceiling, which stays unchanged.
export const JS_ENTRY_BUDGETS: readonly JsEntryBudget[] = derive([
  // 2026-10-09: the root barrel measured 257952 with Slider, over its 257843 ceiling, so it
  // recalibrates to measured × 1.5.
  { name: ".", entryFile: "index.js", measuredGzip: 257952, ceilingGzip: 386928 },
  { name: "theme", entryFile: "theme.js", measuredGzip: 6197, ceilingGzip: 9194 },
  { name: "badge", entryFile: "badge.js", measuredGzip: 15739, ceilingGzip: 23493 },
  { name: "button", entryFile: "button.js", measuredGzip: 25571, ceilingGzip: 37821 },
  // 2026-10-21: card measured 25171 once Card.SectionButton brought Base UI's useRender and
  // mergeProps and the shared focus ring and state face into the entry. Main, whose row still
  // records 16100, re-measured 16652 the same day, so the change adds 8519 and the ceiling rises
  // by that delta, from 23937.
  { name: "card", entryFile: "card.js", measuredGzip: 25171, ceilingGzip: 32456 },
  { name: "dialog", entryFile: "dialog.js", measuredGzip: 46343, ceilingGzip: 67844 },
  { name: "popover", entryFile: "popover.js", measuredGzip: 57668, ceilingGzip: 85298 },
  { name: "scroll-area", entryFile: "scroll-area.js", measuredGzip: 28482, ceilingGzip: 42731 },
  { name: "illustrations", entryFile: "illustrations.js", measuredGzip: 11036, ceilingGzip: 16580 },
  { name: "separator", entryFile: "separator.js", measuredGzip: 10621, ceilingGzip: 15786 },
  { name: "field", entryFile: "field.js", measuredGzip: 30596, ceilingGzip: 45407 },
  { name: "item", entryFile: "item.js", measuredGzip: 24394, ceilingGzip: 36177 },
  { name: "input", entryFile: "input.js", measuredGzip: 25443, ceilingGzip: 37569 },
  { name: "input-group", entryFile: "input-group.js", measuredGzip: 28528, ceilingGzip: 42002 },
  { name: "textarea", entryFile: "textarea.js", measuredGzip: 21587, ceilingGzip: 31917 },
  { name: "flags", entryFile: "flags.js", measuredGzip: 1456, ceilingGzip: 2082 },
  // `pnpm gen component` appends a 0-ceiling row below this marker, so a brand-new packed
  // entry cannot slip through unbudgeted. Replace the 0 with measured × 1.5.
  // plop:js-entry-budget
  // 2026-11-05: new entry, measured at 36764. Button and its Base UI root for the controls, Base UI's
  // useRender and mergeProps, the four caret and two rotation icons, the shared focus ring, and
  // the React-free page math and scroll-snap engine.
  { name: "carousel", entryFile: "carousel.js", measuredGzip: 36764 },
  // 2026-10-28: new entries. AutocompleteField and ComboboxField put the Autocomplete and Combobox
  // parts in the FieldFrame that SelectField wears.
  { name: "autocomplete-field", entryFile: "autocomplete-field.js", measuredGzip: 80251 },
  { name: "combobox-field", entryFile: "combobox-field.js", measuredGzip: 79490 },
  // 2026-10-26: new entry, measured at 76887. Base UI's Autocomplete shares the Combobox internals,
  // and the parts render InputGroup and the shared overlay portal.
  { name: "autocomplete", entryFile: "autocomplete.js", measuredGzip: 76887 },
  // 2026-10-23: new entry, measured at 25337. Base UI's useRender and mergeProps, the shared focus
  // ring and state face, and the pure accept, split and read modules.
  { name: "file-upload", entryFile: "file-upload.js", measuredGzip: 25337 },
  // 2026-10-22: new entries. Attachment renders Button and Base UI's ScrollArea, useRender and
  // mergeProps. AspectRatio renders one div through `cn`.
  { name: "attachment", entryFile: "attachment.js", measuredGzip: 35347 },
  { name: "aspect-ratio", entryFile: "aspect-ratio.js", measuredGzip: 21363 },
  // 2026-11-03: new entry, measured at 23701. Link moved off React Aria onto Base UI's useRender,
  // replacing the react-aria/link entry, measured at 32413.
  { name: "link", entryFile: "link.js", measuredGzip: 23701 },
  // 2026-10-20: new entry, measured at 154062 with the add menu. It renders Toolbar, Menu,
  // Popover, Select, Combobox, ToggleGroup, NumberField and Slider, so the ceiling follows what
  // those cost.
  { name: "data-table-filter", entryFile: "data-table-filter.js", measuredGzip: 154062, ceilingGzip: 231093 },
  // Chart preview entry. Measured 129203 on 2026-10-31, within the ceiling from layer 05.
  // Raised from the derived 145566 on 2026-11-03. An active dot on a Bar series rides a straight
  // track through the bars' far ends, read from the loop's resting bars, and its glide follows the
  // spring through its overshoot, which measured 562 bytes on this entry (145148 to 145710). The
  // ceiling keeps about 100 bytes of headroom.
  // Raised from 145800 on 2026-11-03. The tooltip's roof holds each ridden bar track as an
  // invisible line, so a dot riding over the gap between two bars stays under the popup, which
  // measured 208 bytes on this entry (145710 to 145918). The ceiling keeps about 100 bytes of
  // headroom.
  // Raised from 146020 on 2026-11-03. The active dot's ride keyframes come from every vertex its
  // track crosses, its bar track follows the loop's resting revision, the tooltip's roof reads
  // again when a rider comes or goes, and the ride starts and ends where the joined dot shows,
  // which measured 582 bytes on this entry (145918 to 146500). The ceiling keeps about 100 bytes
  // of headroom.
  // Raised from 146600 on 2026-11-03. The active dot's glide evaluates the keyframes it plays,
  // starts from where the dot shows, holds at a track's end, keeps a Line's last stack and reads a
  // path-form BarGroup's own columns, and each Root keeps its own rider registry, which measured
  // 384 bytes on this entry (146500 to 146884). The ceiling keeps about 100 bytes of headroom.
  // Raised from 146984 on 2026-11-03. The active dot's glide reads the easing it plays, its line
  // comes through Root's paths from the drawing it joins, an Area hands over its top edge, a curve
  // that bends back keeps its later spans, and a ride keeps to one run, which measured 534 bytes on
  // this entry (146884 to 147418). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 147518 on 2026-11-03. A ride starting or resting on a reading inside a bend
  // the run leaves out counts that bend as a stack, which measured 180 bytes on this entry (147418
  // to 147598). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 147698 on 2026-11-03. Reveal's edge glides with the crosshair on the step's
  // spring, as a registered length, which measured 179 bytes on this entry (147598 to 147777). The
  // ceiling keeps about 100 bytes of headroom.
  // Raised again from 147877 on 2026-11-04. A series colour can be a threshold, whose paint, legend
  // entries and non-finite rule join the scale's, dots, markers and the active dot paint their own
  // value's step, crossfading dots and active dots keep it, a path-form bar's projected and
  // estimated paths and its emphasis boxes paint by step, and Glow haloes a value-painted series
  // through its own SVG filter, which measured 1428 bytes on this entry (147777 to 149205). The
  // ceiling keeps about 100 bytes of headroom.
  // Raised again from 149305 on 2026-11-04, after the threshold colours above. ScatterChart, its
  // model, spatial index, domain glide, surface and parts, and its review rounds, which carry the
  // active point, the keyboard's place and the series focus across a data update in one
  // transition, clip reference segments to the domains, pick points through the gliding domains,
  // hold the point while the pointer crosses the tooltip, commit a press with the walk it carries,
  // make the pointer's input kind observable, route a touch the tooltip takes through the plot's
  // own tap, resolve the nearest point once, write the store through named transitions, share
  // Chart's intro rule, ref merge and tap lift, end a tap's focus guard with its own task, reset a
  // gesture its element outlives and move the tooltip with its mark's size, measured 11835 bytes
  // on this entry (149205 to 161040). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 161140 on 2026-11-05. A reading other than 0 keeps one device pixel
  // along the value axis, grown from the zero rule and kept inside the plot, its projection
  // kept apart from its neighbour's, and a stack settles which segment keeps that pixel on
  // each side in every frame through the batched floor registry, which bars, path-form
  // columns, emphasis boxes and the active overlay read, which measured 2860 bytes on this
  // entry (161040 to 163900). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 164000 on 2026-11-05. The shared readout parts read their Root through the
  // readout port, which each Root builds over its own model: the cartesian readout, its series
  // readout and its pick, the tooltip and table bodies the family's Tooltip and Table parts hand
  // their anchor and rows, and the leaves ScatterChart now shares, the popup's positioner, its
  // dismissal filter and class, the series label, the role helpers and the Empty and Skeleton
  // bodies, which measured 2096 bytes on this entry (163778 to 165874). The ceiling keeps about
  // 100 bytes of headroom.
  // Raised again from 165974 on 2026-11-05. The polar Roots draw through their own kernel: the
  // Root and its aspect-locked cell, the listbox surface with the polar key maps, the item and
  // series adapters, the polar Tooltip's anchor and orbit, the polar Tables, the polar motion
  // binder and exit ghosts, and the polar words in their own dictionary, which measured 11441
  // bytes on this entry (165874 to 177315). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 177415 on 2026-11-05. The pie draws: its slices on one frame per loop with the
  // rim floor and the ghosts that collapse, the labels with their leaders and the client's second
  // placing, the Track, the Center parts with the digit roll, the Glow's mirror and the slices'
  // gradients, which measured 6947 bytes on this entry (177315 to 184262). The ceiling keeps about
  // 100 bytes of headroom.
  // Raised again from 184362 on 2026-11-05. The rings draw: their frame with the ring floor, the
  // solid, dotted and segmented looks, the radial Track and Glow, the centre's numbers for both
  // families, the hatch of an estimated slice or ring, and the gauge Track's corners, which
  // measured 2638 bytes on this entry (184262 to 186900). The ceiling keeps about 100 bytes of
  // headroom.
  // Raised again from 187000 on 2026-11-05. The radar draws: its grid with the zero ring and the
  // spoke hand, both axes' labels, the Area's, Line's and Dots' writers with the quality runs, the
  // active dot's ride, the role-list gradients, Glow, and the entrance's span over rings, spokes and
  // labels, which measured 3612 bytes on this entry (186900 to 190512). The ceiling keeps about 100
  // bytes of headroom.
  // Raised again from 190612 on 2026-11-05. The clock draws: its model over the zoned time domain,
  // its Root, its curves sampled in unrolled angle and radius, its wedges with constant gaps and
  // floors, its labels fitted round the dial, its hands, references, centre and value parts, the
  // threshold rings, and the shared seams it floors, glows and totals through, which measured
  // 13205 bytes on this entry (190512 to 203717). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 203817 on 2026-11-05. The feel pass: the ring values' fit against the angle
  // labels and the marks with its choice of spoke, the radar's spoke labels thinned by stride, the
  // radar's and clock's active dots on the loop with the clock's curve registry, the pie labels that
  // follow the slices' frame, the coarse clock slots, the glow and decimation measured from the
  // drawn dial, and the entrance's pace read from the figure, which measured 2665 bytes on this
  // entry (203717 to 206382). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 206482 on 2026-11-05. Now's label fits past the rim against the cycle's labels
  // instead of sitting inside it, which measured 105 bytes on this entry (206382 to 206487). The
  // ceiling keeps about 100 bytes of headroom.
  // Raised again from 206587 on 2026-11-05, fix round 1: the clock parts split into modules over a
  // shared leaf (Q1), the item reading rules (B9), the painted-angle pick (Q2), the clock tooltip's
  // stack totals (B11), the reference area's time range (B10) and the half-hour label rule (B12),
  // which measured 815 bytes on this entry (206487 to 207302). The ceiling keeps about 100 bytes of
  // headroom.
  // Raised again from 207402 on 2026-11-05, fix round 2: the clock's grid, axes, references and
  // hands, the radar's grid, axes, ActiveDot and Glow, and the pie centre's numbers each in a module
  // of their own (Q1), the hatch folded into the sampled turn (B1), the Area's quality mask (B2),
  // the datum slots resolved to their owner (B3), duplicate categories (B4), the dotted ring's floor
  // (B6), and every Root's own scope resetting each family's Root contexts from one light leaf
  // (Q2), which measured 565 bytes on this entry (207302 to 207867). The ceiling keeps about 100
  // bytes of headroom.
  // Raised again from 207976 on 2026-11-05, fix round 3: the tooltip's corridor from a part to its
  // popup (B1), the fold's drawing weights (Q2, B3), Other's quality (Q1), formats compared in any
  // key order (B4), and each Root's depth on its figure (B6), the tooltip's corridor (B1), the step
  // curves' slot ranges (Q3, B7), routes that end on their vertex (B8), the Column's and Area's
  // baseline rule (B2), references bounded to the dial (B5), formats compared in any key order
  // (B4), and the orientation the cartesian parts carry, which measured 968 bytes on this entry
  // (207867 to 208835). The ceiling keeps about 100 bytes of headroom.
  // Fix round 4 on 2026-11-06: the step clip's one-sided edges and the one-pass clip and split (B1,
  // Q1), the 12 o'clock step on a split line, references checked against the domain (B2), and
  // undefined format options dropped before comparing (Q2), 208835 to 209108. The ceiling keeps
  // about 100 bytes of headroom.
  // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
  // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
  // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
  // (MOTION-REVIEW R1 to R4, F5 to F11), 209108 to 212860. The ceiling keeps about 100 bytes of
  // headroom.
  // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
  // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
  // 212860 to 214091. The ceiling keeps about 100 bytes of headroom.
  { name: "chart", entryFile: "chart.js", measuredGzip: 97044, ceilingGzip: 214191 },
  // 2026-10-13: new entry, measured at 29180. Pure wrappers over Base UI's toolbar and its roving focus.
  { name: "toolbar", entryFile: "toolbar.js", measuredGzip: 29180, ceilingGzip: 43770 },
  // 2026-10-12: new entries. Command is Base UI's Autocomplete in the InputGroup, with the Dialog
  // parts for Command.Content. CommandVirtual keeps the optional @tanstack/react-virtual peer external.
  { name: "command", entryFile: "command.js", measuredGzip: 68632 },
  { name: "command-virtual", entryFile: "command-virtual.js", measuredGzip: 58247 },
  { name: "kbd", entryFile: "kbd.js", measuredGzip: 21431 },
  // 2026-10-09: new entry, measured at 71305. Select's parts in the FieldFrame that TextField wears.
  { name: "select-field", entryFile: "select-field.js", measuredGzip: 71305, ceilingGzip: 106958 },
  // 2026-10-09: new entry, measured at 43729. A labeled composite over Field and Base UI's Slider.
  { name: "slider", entryFile: "slider.js", measuredGzip: 43729, ceilingGzip: 65594 },
  // 2026-10-05: new entry, measured at 2780. A pure wrapper over Base UI's Form.
  { name: "form", entryFile: "form.js", measuredGzip: 2780, ceilingGzip: 4170 },
  // 2026-10-02: new entry, measured at 59084. Base UI's navigation menu brings its floating positioner, as Popover does.
  { name: "navigation-menu", entryFile: "navigation-menu.js", measuredGzip: 59084, ceilingGzip: 88307 },
  // 2026-09-30: new entry. It composes Select, DropdownMenu, Checkbox, Field and Button; the
  // optional @tanstack/react-table peer is external.
  { name: "data-table", entryFile: "data-table.js", measuredGzip: 95534, ceilingGzip: 143301 },
  { name: "sidebar", entryFile: "sidebar.js", measuredGzip: 82769, ceilingGzip: 123748 },
  { name: "toast", entryFile: "toast.js", measuredGzip: 43158, ceilingGzip: 63440 },
  {
    name: "phone-number-field",
    entryFile: "phone-number-field.js",
    measuredGzip: 120212,
    ceilingGzip: 174516,
  },
  {
    name: "popover-info-button",
    entryFile: "popover-info-button.js",
    measuredGzip: 61411,
    ceilingGzip: 90792,
  },
  { name: "combobox", entryFile: "combobox.js", measuredGzip: 75479, ceilingGzip: 109703 },
  { name: "toggle-group", entryFile: "toggle-group.js", measuredGzip: 29541, ceilingGzip: 43413 },
  { name: "checkbox-card", entryFile: "checkbox-card.js", measuredGzip: 30303, ceilingGzip: 45285 },
  { name: "radio-group", entryFile: "radio-group.js", measuredGzip: 41712, ceilingGzip: 60297 },
  { name: "checkbox", entryFile: "checkbox.js", measuredGzip: 38951, ceilingGzip: 55520 },
  { name: "selection-item", entryFile: "selection-item.js", measuredGzip: 32423, ceilingGzip: 47954 },
  { name: "switch", entryFile: "switch.js", measuredGzip: 26581, ceilingGzip: 39825 },
  { name: "button-group", entryFile: "button-group.js", measuredGzip: 17738, ceilingGzip: 26381 },
  { name: "accordion", entryFile: "accordion.js", measuredGzip: 30624, ceilingGzip: 45276 },
  { name: "description-list", entryFile: "description-list.js", measuredGzip: 10794, ceilingGzip: 16070 },
  { name: "emoji", entryFile: "emoji.js", measuredGzip: 2442 },
  { name: "avatar", entryFile: "avatar.js", measuredGzip: 12898, ceilingGzip: 18701 },
  { name: "alert-dialog", entryFile: "alert-dialog.js", measuredGzip: 48778, ceilingGzip: 71367 },
  { name: "dropdown-menu", entryFile: "dropdown-menu.js", measuredGzip: 69465, ceilingGzip: 102293 },
  { name: "collapsible", entryFile: "collapsible.js", measuredGzip: 27627, ceilingGzip: 40881 },
  { name: "select", entryFile: "select.js", measuredGzip: 64967, ceilingGzip: 95586 },
  { name: "show", entryFile: "show.js", measuredGzip: 148 },
  { name: "loader", entryFile: "loader.js", measuredGzip: 16852, ceilingGzip: 25122 },
  { name: "empty", entryFile: "empty.js", measuredGzip: 21399, ceilingGzip: 32034 },
  { name: "frame", entryFile: "frame.js", measuredGzip: 9109, ceilingGzip: 13589 },
  { name: "code", entryFile: "code.js", measuredGzip: 12857, ceilingGzip: 17634 },
  { name: "span", entryFile: "span.js", measuredGzip: 17419, ceilingGzip: 25986 },
  { name: "timeline-list", entryFile: "timeline-list.js", measuredGzip: 23579, ceilingGzip: 35330 },
  { name: "sheet", entryFile: "sheet.js", measuredGzip: 57967, ceilingGzip: 85812 },
  { name: "text-field", entryFile: "text-field.js", measuredGzip: 34371, ceilingGzip: 50193 },
  { name: "tooltip", entryFile: "tooltip.js", measuredGzip: 51784, ceilingGzip: 76722 },
  { name: "heading", entryFile: "heading.js", measuredGzip: 17413, ceilingGzip: 25924 },
  { name: "text", entryFile: "text.js", measuredGzip: 17418, ceilingGzip: 25919 },
  { name: "toggle", entryFile: "toggle.js", measuredGzip: 25703, ceilingGzip: 38223 },
  // 2026-11-09: skeleton measured 21526 once SkeletonReveal joined Skeleton in the entry, bringing
  // Base UI's useRender and mergeProps, the locale dictionary, the ghost measuring, the pane swap
  // with its fade and height owners and shared geometry reader, and the form, Field, label and
  // overlay exclusion, which reads Base UI's Field and labelable wiring. Main, whose row still
  // records 8753, re-measured 9067 the same day, so the change adds 12459 and the ceiling rises by
  // that delta, from 13052.
  { name: "skeleton", entryFile: "skeleton.js", measuredGzip: 21526, ceilingGzip: 25511 },
  { name: "number-field", entryFile: "number-field.js", measuredGzip: 42364, ceilingGzip: 60983 },
  { name: "meter", entryFile: "meter.js", measuredGzip: 27862, ceilingGzip: 41048 },
  { name: "tabs", entryFile: "tabs.js", measuredGzip: 26252, ceilingGzip: 38664 },
  { name: "confirm-button", entryFile: "confirm-button.js", measuredGzip: 25977, ceilingGzip: 38438 },
  { name: "table", entryFile: "table.js", measuredGzip: 12010, ceilingGzip: 17721 },
  { name: "textarea-field", entryFile: "textarea-field.js", measuredGzip: 33800, ceilingGzip: 46464 },
  { name: "pagination", entryFile: "pagination.js", measuredGzip: 19671, ceilingGzip: 28785 },
  { name: "breadcrumb", entryFile: "breadcrumb.js", measuredGzip: 25527, ceilingGzip: 37869 },
  { name: "alert", entryFile: "alert.js", measuredGzip: 30996, ceilingGzip: 45885 },
  {
    name: "react-aria/ui-providers",
    entryFile: "react-aria/ui-providers.js",
    measuredGzip: 2031,
    ceilingGzip: 2981,
  },
  {
    name: "react-aria/date-field",
    entryFile: "react-aria/date-field.js",
    measuredGzip: 71488,
    ceilingGzip: 105099,
  },
  {
    name: "react-aria/calendar",
    entryFile: "react-aria/calendar.js",
    measuredGzip: 62362,
    ceilingGzip: 91506,
  },
  {
    name: "react-aria/range-calendar",
    entryFile: "react-aria/range-calendar.js",
    measuredGzip: 63827,
    ceilingGzip: 93471,
  },
  {
    name: "react-aria/date-picker",
    entryFile: "react-aria/date-picker.js",
    measuredGzip: 107196,
    ceilingGzip: 157282,
  },
  {
    name: "react-aria/date-range-picker",
    entryFile: "react-aria/date-range-picker.js",
    measuredGzip: 106711,
    ceilingGzip: 156552,
  },
  {
    name: "react-aria/search-field",
    entryFile: "react-aria/search-field.js",
    measuredGzip: 42976,
    ceilingGzip: 62397,
  },
  {
    name: "react-aria/grid-list",
    entryFile: "react-aria/grid-list.js",
    measuredGzip: 70571,
    ceilingGzip: 100964,
  },
  {
    name: "react-aria/focusable",
    entryFile: "react-aria/focusable.js",
    measuredGzip: 4680,
    ceilingGzip: 5463,
  },
  {
    name: "react-aria/file-trigger",
    entryFile: "react-aria/file-trigger.js",
    measuredGzip: 37687,
    ceilingGzip: 54725,
  },
] satisfies readonly Measured<JsEntryBudget>[]);

export const NAMED_IMPORT_BUDGETS: readonly NamedImportBudget[] = derive([
  // The chart rows: whole namespaces (BarChart stands for every cartesian alias), routes that keep
  // only the members they name, and the server-safe helpers. Last measured 2026-10-31, each within
  // its ceiling: Chart 126903, BarChart 126905, the polar namespaces 83087, 83062 and 83025,
  // Chart.Root 50192, the bar route 68130, useChartPoint 3933, Sparkline 11384.
  // 2026-11-03: the active dot rides its series' drawn line on a pointer-paced spring shared with
  // the crosshair, which measured 1956 bytes on Chart (140885 to 142841) and on BarChart (140887
  // to 142843), both under their derived ceilings.
  // 2026-11-03: the active dot rides a Bar series' far ends as well, which measured 570 bytes on
  // Chart (142841 to 143411) and on BarChart (142843 to 143413), both under their derived ceilings.
  // 2026-11-03: the tooltip's roof holds each ridden bar track, which measured 210 bytes on Chart
  // (143411 to 143621) and on BarChart (143413 to 143623), both under their derived ceilings.
  // Raised from the derived 143981 and 143984 on 2026-11-03. The active dot's ride keyframes come
  // from every vertex its track crosses, its bar track follows the loop's resting revision, the
  // tooltip's roof reads again when a rider comes or goes, and the ride starts and ends where the
  // joined dot shows, which measured 583 bytes on Chart (143621 to 144204) and on BarChart (143623
  // to 144206). Each ceiling keeps about 100 bytes of headroom.
  {
    name: "chart/Chart",
    entryFile: "chart.js",
    exportName: "Chart",
    measuredGzip: 95987,
    // Raised from 144304 on 2026-11-03, with BarChart's from 144306. The active dot's glide
    // evaluates the keyframes it plays, starts from where the dot shows, holds at a track's end,
    // keeps a Line's last stack and reads a path-form BarGroup's own columns, and each Root keeps
    // its own rider registry, which measured 380 bytes on Chart (144204 to 144584) and on BarChart
    // (144206 to 144586). Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 144684 on 2026-11-03, with BarChart's from 144686. The active dot's glide
    // reads the easing it plays, its line comes through Root's paths from the drawing it joins, an
    // Area hands over its top edge, a curve that bends back keeps its later spans, and a ride keeps
    // to one run, which measured 537 bytes on Chart (144584 to 145121) and on BarChart (144586 to
    // 145123). Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 145221 on 2026-11-03, with BarChart's from 145223. A ride starting or
    // resting on a reading inside a bend the run leaves out counts that bend as a stack, which
    // measured 179 bytes on Chart (145121 to 145300) and 180 on BarChart (145123 to 145303).
    // Raised again from 145400 on 2026-11-03, with BarChart's from 145403. Reveal's edge glides
    // with the crosshair on the step's spring, which measured 182 bytes on Chart (145300 to 145482)
    // and 181 on BarChart (145303 to 145484).
    // Raised again from 145582 on 2026-11-04, with BarChart's from 145584. A series colour can be a
    // threshold, whose paint, legend entries and non-finite rule join the scale's, dots, markers
    // and the active dot paint their own value's step, crossfading dots and active dots keep it, a
    // path-form bar's projected and estimated paths and its emphasis boxes paint by step, and Glow
    // haloes a value-painted series through its own SVG filter, which measured 1425 bytes on Chart
    // (145482 to 146907) and 1426 on BarChart (145484 to 146910). Each ceiling keeps about 100
    // bytes of headroom.
    // Raised again from 147007 on 2026-11-04, with BarChart's from 147010, after the threshold
    // colours above. ScatterChart's strings in the shared chart dictionary and its three data-rule
    // messages, Chart.Root's merge of a consumer ref with its own, the surface's tap lift in the
    // shared record, whose focus guard ends with the tap's own task and whose gesture ends with the
    // surface's element, and the leaves Chart now shares with ScatterChart, the table's disclosure
    // and pagination shell, the count words, the generic issue grouping, the config comparison, the
    // motion host and the draw gate's read, measured 391 bytes on Chart (146907 to 147298) and 390
    // on BarChart (146910 to 147300). Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 147398 on 2026-11-05, with BarChart's from 147400. A reading other
    // than 0 keeps one device pixel along the value axis, grown from the zero rule and kept
    // inside the plot, its projection kept apart from its neighbour's, and a stack settles
    // which segment keeps that pixel on each side in every frame through the batched floor
    // registry, which bars, path-form columns, emphasis boxes and the active overlay read,
    // which measured 2869 bytes on Chart (147298 to 150167) and on BarChart (147300 to
    // 150169). Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 150267 on 2026-11-05, with BarChart's from 150269. The shared readout
    // parts read Root through its readout port: the cartesian readout over the series readout and
    // the pick, the tooltip body that the cartesian Tooltip hands its anchor, the table body that
    // the cartesian Table hands its rows, and the popup leaves ScatterChart now shares, which
    // measured 2420 bytes on Chart (150013 to 152433) and 2421 on BarChart (150015 to 152436).
    // Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 152533 on 2026-11-05, with BarChart's from 152536. Chart's and
    // ScatterChart's surfaces share one listbox leaf: the option handoff, the press's end with
    // the surface's element, the listbox's naming and the status region, which measured 255 bytes
    // on Chart (152433 to 152688) and on BarChart (152436 to 152691), while the whole entry, which
    // ships both surfaces, fell by 86. Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 152788 on 2026-11-05, with BarChart's from 152791. Every Root takes the
    // own scope from its own leaf, the shared data rules name the three polar rules' messages, the
    // loop's entrance takes its own duration, each Tooltip's anchor gives its side and align
    // offsets, and the glide's path route says whether it keeps its side or the popup's centre,
    // which measured 332 bytes on Chart (152688 to 153020) and on BarChart (152691 to 153023).
    // Each ceiling keeps about 100 bytes of headroom.
    // Raised again from 153120 on 2026-11-05, with BarChart's from 153123. The stack floors read a
    // floor axis a frame lends through `floorAxisOf`, the value floor's arithmetic sits in its own
    // leaf, the value glow's filter reads a region with its unit, the stack total row moved into a
    // leaf the clock shares, and the loop's entrance takes a linear curve, so a clock dial floors,
    // glows and totals through the same code without the plot frame. That measured 201 bytes on
    // Chart (153090 to 153291) and on BarChart (153093 to 153294). Each ceiling keeps about 100
    // bytes of headroom.
    // Raised again from 153391 on 2026-11-05, polar fix round 2, with BarChart's from 153394. Every
    // Root's own scope resets each family's Root contexts, the cartesian ones now in a light leaf,
    // so a part under a nested Root of another family reaches no outer Root (Q2), which measured
    // 111 bytes on Chart (153291 to 153402) and on BarChart (153294 to 153405). Each ceiling
    // keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: each Root's depth on its figure and the orientation the parts that
    // read it carry (B6), and formats compared in any key order (B4), 153402 to 153643. The ceiling
    // keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 153643 to 153776. The ceiling keeps about 100 bytes of
    // headroom.
    ceilingGzip: 153876,
  },
  {
    name: "chart/BarChart",
    entryFile: "chart.js",
    exportName: "BarChart",
    measuredGzip: 95989,
    // Raised from 153123 on 2026-11-05 with Chart's, for the same cause.
    // Raised again from 153394 on 2026-11-05 with Chart's, for polar fix round 2's own-scope reset.
    // Fix round 3 on 2026-11-05: each Root's depth on its figure and the orientation the parts that
    // read it carry (B6), and formats compared in any key order (B4), 153405 to 153645. The ceiling
    // keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 153645 to 153779. The ceiling keeps about 100 bytes of
    // headroom.
    ceilingGzip: 153879,
  },
  // Set from its measurement on 2026-11-05, when the polar families landed: the whole namespace: slices on their frame with the rim floor and ghosts, labels and leaders that ride the frame, Track, Center parts, Glow and the polar readouts. The ceiling
  // keeps about 100 bytes of headroom.
  {
    name: "chart/PieChart",
    entryFile: "chart.js",
    exportName: "PieChart",
    measuredGzip: 105684,
    // Fix round 1 on 2026-11-05: reading-rule errors and warnings on items (B9) and the pick over the frame's painted
    // angles (Q2), 105684 to 106075. The ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: duplicate categories (B4), the centre's numbers in their own
    // module (Q1), and every Root's own scope resetting each family's Root contexts from one light
    // leaf (Q2), 106075 to 106238. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor from a part to its popup (B1), the fold's
    // drawing weights (Q2, B3), Other's quality (Q1), formats compared in any key order (B4), and
    // each Root's depth on its figure (B6), 106238 to 106799. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 106799 to 110278. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 110278 to 111355. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 111455,
  },
  // Set from its measurement on 2026-11-05, when the polar families landed: the whole namespace: rings on their frame in three looks, Track, Glow, the Center parts and the polar readouts. The ceiling
  // keeps about 100 bytes of headroom.
  {
    name: "chart/RadialChart",
    entryFile: "chart.js",
    exportName: "RadialChart",
    measuredGzip: 102151,
    // Fix round 1 on 2026-11-05: reading-rule errors and warnings on items (B9) and the painted-angle registry
    // (Q2), 102151 to 102522. The ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: duplicate categories with each ring's maximum kept on its own row
    // (B4), the dotted ring's one-dot floor (B6), the centre's numbers in their own module (Q1),
    // and every Root's own scope resetting each family's Root contexts from one light leaf (Q2),
    // 102522 to 102737. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor from a part to its popup (B1), the fold's
    // drawing weights (Q2, B3), Other's quality (Q1), formats compared in any key order (B4), and
    // each Root's depth on its figure (B6), 102737 to 103205. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 103205 to 106563. The ceiling keeps about 100 bytes of
    // headroom.
    // CenterName on 2026-11-06: the centre's active name line, a new shared pie and radial part,
    // 106563 to 106858. The ceiling keeps about 100 bytes of headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 106858 to 107874. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 107974,
  },
  // Set from its measurement on 2026-11-05, when the polar families landed: the whole namespace: grid, spoke and ring labels fitted to the dial, Area, Line, Dots, an ActiveDot on the loop, Glow and the polar readouts. The ceiling
  // keeps about 100 bytes of headroom.
  {
    name: "chart/RadarChart",
    entryFile: "chart.js",
    exportName: "RadarChart",
    measuredGzip: 107377,
    // Fix round 2 on 2026-11-05: Grid, both axes, ActiveDot and Glow in modules of their own (Q1),
    // and every Root's own scope resetting each family's Root contexts from one light leaf (Q2),
    // 107377 to 107489. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor (B1), formats compared in any key order
    // (B4), and each Root's depth on its figure (B6), 107489 to 107893. The ceiling keeps about 100
    // bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 107893 to 110766. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 110766 to 111862. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 111962,
  },
  // Set from its measurement on 2026-11-05, when the polar families landed: the whole namespace: the zoned dial model, curves, wedges with floors and coarse slots, labels and ring values fitted to the dial, hands, Now, references, centre and value parts, and the polar readouts. The ceiling
  // keeps about 100 bytes of headroom.
  {
    name: "chart/ClockChart",
    entryFile: "chart.js",
    exportName: "ClockChart",
    measuredGzip: 122917,
    // Fix round 1 on 2026-11-05: the parts split into modules over a shared leaf (Q1), the tooltip's stack
    // totals (B11), the reference area's time range (B10) and the coarse owner in the pick (Q3),
    // 122917 to 123362. The ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: the grid, axes, references and hands in modules of their own (Q1),
    // the hatch folded into the sampled turn (B1), the Area's quality mask (B2), the gradient's zero
    // from the scale (B5), the datum slots resolved to their owner (B3), and every Root's own scope
    // resetting each family's Root contexts and the clock Marker's from light leaves (Q2), 123362 to
    // 123645. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor (B1), the step curves' slot ranges (Q3,
    // B7), routes that end on their vertex (B8), the Column's and Area's baseline rule (B2),
    // references bounded to the dial (B5), formats compared in any key order (B4), and each Root's
    // depth on its figure (B6), 123645 to 124386. The ceiling keeps about 100 bytes of headroom.
    // Fix round 4 on 2026-11-06: the step clip's one-sided edges and the one-pass clip and split
    // (B1, Q1), the 12 o'clock step on a split line, references checked against the domain (B2),
    // and undefined format options dropped before comparing (Q2), 124386 to 124639. The ceiling
    // keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 124639 to 128234. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 128234 to 129321. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 129421,
  },
  {
    name: "chart/Chart.Root",
    entryFile: "chart.js",
    exportName: "Chart",
    members: ["Root"],
    measuredGzip: 41019,
  },
  {
    name: "chart/Chart bar route",
    entryFile: "chart.js",
    exportName: "Chart",
    members: ["Root", "Grid", "XAxis", "YAxis", "Bar"],
    measuredGzip: 48267,
    // Raised from the derived 72401 on 2026-11-01. Every chart now plays its entrance the first
    // time it comes into view, hydrated or not. The shared observer, the reveal checks and their
    // teardown, and the loop's wait and play measured about 400 bytes on this route. The ceiling
    // keeps about 100 bytes of headroom.
    // Raised from 72900 on 2026-11-02. The tooltip reads where a data update's marks land through
    // the loop's `eachLanding`, which measured 67 bytes on this route (72841 to 72908) after the
    // reading itself moved into the tooltip's own module. The ceiling keeps about 90 bytes of
    // headroom.
    // Raised from 73000 on 2026-11-02. The entrance now watches the clipping ancestors of a waiting
    // plot, cancels a reveal frame its effect outlives, and retires `data-entrance` on a cancelled
    // wipe or at once with no wipe, which measured 139 bytes on this route (72908 to 73047). The
    // ceiling keeps about 100 bytes of headroom.
    // Raised from 73150 on 2026-11-02. The slot grid, which makes every bar and every gap of a
    // chart the same whole device pixels, measured 563 bytes on this route (73047 to 73610). The
    // ceiling keeps about 100 bytes of headroom.
    // Raised from 73710 on 2026-11-02. A resize maps running tweens through the slot grid, so a
    // path keeps tweening, a plot of no length keeps its slot lookups finite, and a group's gaps
    // leave each bar a device pixel, which measured 144 bytes on this route (73610 to 73754). The
    // ceiling keeps about 100 bytes of headroom.
    // Raised from 73850 on 2026-11-02. A sliding vertex outside the slot run keeps its own place,
    // the Line and Area layers clip at the run's ends, and a path-form Bar's route retargets its
    // rounded column edges on a resize, which measured 129 bytes on this route (73754 to 73883).
    // The ceiling keeps about 100 bytes of headroom.
    // Raised from 73990 on 2026-11-03. Root records the x axis's format for Chart.SlotLabel,
    // repaints its followers when the reader's motion preference changes, and a follower can ask
    // for its own repaint, which measured 82 bytes on this route (73933 to 74015). The ceiling
    // keeps about 100 bytes of headroom.
    // Raised from 74115 on 2026-11-03. The active dot rides its series' drawn line on a
    // pointer-paced spring shared with the crosshair, and the store tracks the pointer's speed for
    // it, which measured 75 bytes on this route (74097 to 74172). The ceiling keeps about 100 bytes
    // of headroom.
    // Raised from 74272 on 2026-11-03. The loop counts each change to a resting anchored mark for
    // the active dot's bar track, and attaching resolves what a mark sits on once for the dot's
    // ride too, which measured 114 bytes on this route (74202 to 74316). The ceiling keeps about
    // 100 bytes of headroom.
    // Raised from 74416 on 2026-11-03. Root's paths hold each path's reader of the line it rests
    // on, which measured 36 bytes on this route (74381 to 74417). The ceiling keeps about 100 bytes
    // of headroom.
    // Raised from 74517 on 2026-11-04. A series colour can be a threshold: its two-step paint, the
    // bars' fills from its ramp, projected and estimated paths and emphasis boxes painted by step,
    // a value-painted Bar's glow filter, Root's comparison of its sides and its non-finite rule
    // measured 740 bytes on this route (74417 to 75157). The ceiling keeps about 100 bytes of
    // headroom.
    // Raised from 75257 on 2026-11-04, after the threshold colours above. ScatterChart's strings
    // in the shared chart dictionary and its three data-rule messages, the surface's tap lift in
    // the shared record that ends it on every compatibility click, Root's merge of a consumer ref
    // with its own, and the leaves this route shares with ScatterChart, the count words, the
    // generic issue grouping, the config comparison, the motion host and the draw gate's read,
    // measured 511 bytes on this route (75157 to 75668). The ceiling keeps about 100 bytes of
    // headroom.
    // Raised from 75768 on 2026-11-05. A reading other than 0 keeps one device pixel along
    // the value axis, grown from the zero rule and kept inside the plot, its projection kept
    // apart from its neighbour's, and a stack settles which segment keeps that pixel on each
    // side in every frame through the batched floor registry, which bars, path-form columns,
    // emphasis boxes and the active overlay read, which measured 2876 bytes on this route
    // (75668 to 78544). The ceiling keeps about 100 bytes of headroom.
    // Raised from 78644 on 2026-11-05. Root builds the readout port the shared parts read: the
    // cartesian readout, the series readout's reading text, shares and fallback slot, and the
    // swatch's paint and look. The tooltip anchor and the table rows ride with their own parts,
    // so this route ships neither. That measured 1291 bytes on this route (78635 to 79926). The
    // ceiling keeps about 100 bytes of headroom.
    // Raised from 80026 on 2026-11-05. Root's surface reads the listbox leaf it shares with
    // ScatterChart's, the option handoff, the press's end with the surface's element, the
    // listbox's naming and the status region, which measured 234 bytes on this route (79926 to
    // 80160). The ceiling keeps about 100 bytes of headroom.
    // Raised from 80260 on 2026-11-05. Root takes the own scope from its own leaf, the shared
    // data rules name the three polar rules' messages, and the loop's entrance takes its own
    // duration, which measured 271 bytes on this route (80160 to 80431). The ceiling keeps about
    // 100 bytes of headroom.
    // Raised from 80531 on 2026-11-05. The stack floors read a floor axis a frame lends through
    // `floorAxisOf`, the value floor's arithmetic sits in its own leaf, the value glow's filter
    // reads a region with its unit, and the loop's entrance takes a linear curve, so a clock dial
    // floors and glows through the same code without the plot frame, which measured 145 bytes on
    // this route (80448 to 80593). The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: each Root's depth on its figure and the orientation the bar
    // series, axes and crosshair carry (B6) since the last raise, 80593 to 80787. The ceiling keeps
    // about 100 bytes of headroom.
    ceilingGzip: 80887,
  },
  // 2026-11-05: PieChart.Root draws through the polar kernel, no longer a pending stub, so its row
  // starts again at 41609 with the derived ceiling, beside new rows for the RadialChart and
  // RadarChart Roots at 40138 and 48586. None ships cartesian geometry (S15).
  {
    name: "chart/PieChart.Root",
    entryFile: "chart.js",
    exportName: "PieChart",
    members: ["Root"],
    measuredGzip: 43915,
    // Set from its measurement on 2026-11-05, when the polar families landed: the Root through the polar kernel, its listbox, readouts and entrance. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix rounds 1 and 2 on 2026-11-05: the item reading rules (B9), duplicate categories (B4), and
    // every Root's own scope resetting each family's Root contexts from one light leaf (Q2), 43915
    // to 44160. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the fold's drawing weights (Q2, B3), Other's quality (Q1), formats
    // compared in any key order (B4), the corridor the surface reads (B1), and the Root's depth
    // (B6), 44160 to 44570. The ceiling keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 44570 to 46221. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 46221 to 46440. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 46540,
  },
  // 2026-11-05: new row, the typical pie route, as the bar route is Chart's: Root, Pie, the Center
  // parts, Legend and Tooltip, which the owner set beside the whole-namespace row, with the derived
  // ceiling.
  {
    name: "chart/PieChart route",
    entryFile: "chart.js",
    exportName: "PieChart",
    members: [
      "Root",
      "Pie",
      "Center",
      "CenterValue",
      "CenterShare",
      "CenterMax",
      "CenterLabel",
      "CenterName",
      "Legend",
      "Tooltip",
    ],
    measuredGzip: 87143,
    // Set from its measurement on 2026-11-05, when the polar families landed: Root, Pie, the Center parts, Legend and Tooltip. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 1 on 2026-11-05: B9 and Q2 as on the namespace row, 87143 to 87534. The ceiling keeps about
    // 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: B4, Q1 and Q2 as on the namespace row, 87534 to 87694. The ceiling
    // keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor from a part to its popup (B1), the fold's
    // drawing weights (Q2, B3), Other's quality (Q1), formats compared in any key order (B4), and
    // each Root's depth on its figure (B6), 87694 to 88179. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 88179 to 91556. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 91556 to 92610. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 92710,
  },
  // 2026-11-05: new row, the typical radial route: Root, Bar, the Center parts, Legend and Tooltip,
  // which the owner set beside the whole-namespace row, with the derived ceiling.
  {
    name: "chart/RadialChart route",
    entryFile: "chart.js",
    exportName: "RadialChart",
    members: [
      "Root",
      "Bar",
      "Center",
      "CenterValue",
      "CenterShare",
      "CenterMax",
      "CenterLabel",
      "CenterName",
      "Legend",
      "Tooltip",
    ],
    measuredGzip: 83225,
    // Set from its measurement on 2026-11-05, when the polar families landed: Root, Bar, the Center parts, Legend and Tooltip. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 1 on 2026-11-05: B9 and Q2 as on the namespace row, 83225 to 83551. The ceiling keeps about
    // 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: B4, B6, Q1 and Q2 as on the namespace row, 83551 to 83773. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the tooltip's corridor from a part to its popup (B1), the fold's
    // drawing weights (Q2, B3), Other's quality (Q1), formats compared in any key order (B4), and
    // each Root's depth on its figure (B6), 83773 to 84173. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 84173 to 87511. The ceiling keeps about 100 bytes of
    // headroom.
    // CenterName on 2026-11-06: the centre's active name line, a new shared pie and radial part,
    // 87511 to 87628. The ceiling keeps about 100 bytes of headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 87628 to 88618. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 88718,
  },
  {
    name: "chart/RadialChart.Root",
    entryFile: "chart.js",
    exportName: "RadialChart",
    members: ["Root"],
    measuredGzip: 42428,
    // Set from its measurement on 2026-11-05, when the polar families landed: the Root through the polar kernel. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 1 on 2026-11-05: B9's reading rules in the item model and Q2's registry, 42428 to 42766. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: duplicate categories with each ring's maximum kept on its own row
    // (B4), and every Root's own scope resetting each family's Root contexts from one light leaf
    // (Q2), 42766 to 43026. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: formats compared in any key order (B4), the corridor the surface
    // reads (B1), and the Root's depth (B6), 43026 to 43369. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 43369 to 44996. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 44996 to 45202. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 45302,
  },
  {
    name: "chart/RadarChart.Root",
    entryFile: "chart.js",
    exportName: "RadarChart",
    members: ["Root"],
    measuredGzip: 50817,
    // Set from its measurement on 2026-11-05, when the polar families landed: the Root through the polar kernel. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: every Root's own scope resetting each family's Root contexts from
    // one light leaf (Q2), 50817 to 50972. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the corridor the surface reads (B1), formats compared in any key
    // order (B4), and the Root's depth (B6), 50972 to 51297. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 51297 to 52971. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 52971 to 53184. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 53284,
  },
  // 2026-11-05: new row, the typical radar route: Root, Grid, both axes, Area, Line, Legend and
  // Tooltip, which the owner set beside the whole-namespace row, with the derived ceiling.
  {
    name: "chart/RadarChart route",
    entryFile: "chart.js",
    exportName: "RadarChart",
    members: ["Root", "Grid", "AngleAxis", "RadiusAxis", "Area", "Line", "Legend", "Tooltip"],
    measuredGzip: 94894,
    // Set from its measurement on 2026-11-05, when the polar families landed: Root, Grid, both axes, Area, Line, Legend and Tooltip. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 2 on 2026-11-05: lowered to the route's new measurement, 94894 to 94191. The split
    // (Q1), which keeps ActiveDot and Glow off a route of Area and Line, saved more than the own
    // scope's reset (Q2) added.
    // Fix round 3 on 2026-11-05: the tooltip's corridor (B1), formats compared in any key order
    // (B4), and the Root's depth (B6), 94191 to 94603. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 94603 to 97649. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 97649 to 98596. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 98696,
  },
  // 2026-11-05: new rows, ClockChart's Root alone and its typical route: Root, Line, Grid,
  // AngleAxis, Center, Legend and Tooltip, which the owner set, each with the derived ceiling.
  {
    name: "chart/ClockChart.Root",
    entryFile: "chart.js",
    exportName: "ClockChart",
    members: ["Root"],
    measuredGzip: 54320,
    // Set from its measurement on 2026-11-05, when the polar families landed: the Root over the zoned dial model. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix rounds 1 and 2 on 2026-11-05: the coarse owner in the pick (Q3), and every Root's own
    // scope resetting each family's Root contexts and the clock Marker's from light leaves (Q2),
    // 54320 to 54512. The ceiling keeps about 100 bytes of headroom.
    // Fix round 3 on 2026-11-05: the corridor the surface reads (B1), the baseline the dial carries
    // (B2), formats compared in any key order (B4), and the Root's depth (B6), 54512 to 54868. The
    // ceiling keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 54868 to 56540. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 56540 to 56746. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 56846,
  },
  {
    name: "chart/ClockChart route",
    entryFile: "chart.js",
    exportName: "ClockChart",
    members: ["Root", "Line", "Grid", "AngleAxis", "Center", "Legend", "Tooltip"],
    measuredGzip: 110462,
    // Set from its measurement on 2026-11-05, when the polar families landed: Root, Line, Grid, AngleAxis, Center, Legend and Tooltip. The
    // ceiling keeps about 100 bytes of headroom.
    // Fix round 1 on 2026-11-05: lowered by the 5321 bytes the split saved (Q1), since Line, Grid, AngleAxis and
    // Center no longer ship Column, Marker, ValueLabel, ActiveDot, the stack floors or M4, 110462 to
    // 105141.
    // Fix round 2 on 2026-11-05: lowered to the route's new measurement, 105141 to 102986. The
    // second split (Q1), which keeps RadiusAxis, the references, Scrubber, Now, their label fitting
    // and TooltipTotal off a route of Grid, AngleAxis and Center, saved more than the own scope's
    // reset (Q2) added.
    // Fix round 3 on 2026-11-05: the tooltip's corridor (B1), the step curves' slot ranges (Q3,
    // B7), routes that end on their vertex (B8), the Column's and Area's baseline rule (B2),
    // references bounded to the dial (B5), formats compared in any key order (B4), and each Root's
    // depth on its figure (B6), 102986 to 103601. The ceiling keeps about 100 bytes of headroom.
    // Fix round 4 on 2026-11-06: the step clip's one-sided edges and the one-pass clip and split
    // (B1, Q1), the 12 o'clock step on a split line, references checked against the domain (B2),
    // and undefined format options dropped before comparing (Q2), 103601 to 103832. The ceiling
    // keeps about 100 bytes of headroom.
    // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
    // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
    // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
    // (MOTION-REVIEW R1 to R4, F5 to F11), 103832 to 107939. The ceiling keeps about 100 bytes of
    // headroom.
    // Phase M2 on 2026-11-06: the follower's leap and its marks' stretch, the side lane chosen by
    // its widest content, and the opening popup held until placed (MOTION-VERIFY N1 to N9),
    // 107939 to 108836. The ceiling keeps about 100 bytes of headroom.
    ceilingGzip: 108936,
  },
  // 2026-11-04: new rows, measured at 84628 for the whole ScatterChart namespace and 41808 for its
  // Root alone, each with the derived ceiling.
  { name: "chart/ScatterChart", entryFile: "chart.js", exportName: "ScatterChart", measuredGzip: 84628 },
  {
    name: "chart/ScatterChart.Root",
    entryFile: "chart.js",
    exportName: "ScatterChart",
    members: ["Root"],
    measuredGzip: 41808,
  },
  { name: "chart/Sparkline", entryFile: "chart.js", exportName: "Sparkline", measuredGzip: 11118 },
  { name: "chart/useChartPoint", entryFile: "chart.js", exportName: "useChartPoint", measuredGzip: 3635 },
  {
    name: "chart/formatChartValue",
    entryFile: "chart.js",
    exportName: "formatChartValue",
    measuredGzip: 1681,
  },
  { name: "chart/formatChartSlot", entryFile: "chart.js", exportName: "formatChartSlot", measuredGzip: 3048 },
  {
    name: "icons/Check",
    entryFile: "icons.js",
    exportName: "Check",
    measuredGzip: 818,
    ceilingGzip: 1215,
  },
  // 2026-10-20: new row, measured at 28289 against the `button` entry's 28333. The root barrel
  // re-exports PhoneNumberField's metadata and Code's highlighter; this row fails if a root
  // `Button` import stops tree-shaking them away.
  {
    name: "Button from the root barrel",
    entryFile: "index.js",
    exportName: "Button",
    measuredGzip: 28289,
  },
] satisfies readonly Measured<NamedImportBudget>[]);

export const CSS_BUDGETS: readonly CssBudget[] = derive([
  // 2026-09-15: dark palettes for both variants, dark-only reset expansion, grouped selectors.
  // 2026-09-15: also removed the dead toast title selectors (Toast.Title inherits the root's
  // soft foreground). Ceilings ratcheted down by the bytes saved against the standing ones,
  // keeping headroom: themes.css 6786 − 370 = 6416, styles.css 24575 − 109 = 24466.
  // styles.css re-measured at 22965 after the toast description took the root's `--toast-copy`
  // pair (+79 bytes, within the standing ceiling).
  // 2026-09-17: dark external company rules materialize the full reset set, so the cascade no
  // longer depends on emission order. themes.css re-measured at 4472 (+29 gzip over the
  // 2026-09-15 record); no token values changed and the ceiling stays at 6416.
  // 2026-09-19: styles.css re-measured at 23421 (+456), within its standing ceiling of 24466
  // while themes.css is unchanged at 4472/6416.
  // 2026-10-02: styles.css re-measured at 23905 (+484) with the NavigationMenu part classes,
  // within its standing ceiling of 24466, which stays.
  // 2026-10-06: main measured 24451, 15 bytes under that ceiling. The field corner classes,
  // which read `--radius-field` (+142), take styles.css to 24593, over it, so the shared entry
  // recalibrates to measured × 1.5, as a code owner approved.
  // 2026-10-29: main's roles and the 26 chart roles recalibrate the entry to measured × 1.5.
  { name: "themes.css", file: "themes.css", measuredGzip: 6734 },
  // 2026-10-30: the cross-section Frame seam selectors (+119) take styles.css from 36851 to
  // 36970, and the Table edge-inset property, the Frame's derived section clip and the cell
  // padding defaults that edge cells override (+404) to 37374, over its ceiling of 36890, so the
  // shared entry recalibrates to measured × 1.5, as a code owner approved.
  // 2026-10-31: 37489 with the chart roles as Tailwind colours, within the ceiling.
  { name: "styles.css", file: "styles.css", measuredGzip: 37374 },
  // Chart stylesheet. Measured 13523 on 2026-10-31, within the ceiling from layer 05.
  // 2026-11-03: 14920 with Chart.SlotLabel, the line crosshair's fade and the tick fade, about 630
  // bytes over the stylesheet before them, within the ceiling.
  // 2026-11-04: 15840 with ScatterChart's points, option, ring, quiet looks, skeleton dots, its
  // layers in the entrance sweep and the forced-colours list, the points layer's clip past the plot
  // by a dot's radius and a segment reference's label at its last end, less the three entrance
  // wipes ScatterChart never runs. That is 720 bytes over the stylesheet with the threshold colours
  // (15120 to 15840) and over the derived 15134, so the ceiling keeps about 100 bytes of headroom.
  // Raised from 15940 on 2026-11-05. The polar Roots' tokens, their frame's grid areas, the
  // aspect-locked cell, the first paint that hides polar marks until the entrance starts with
  // scripting on and shows them in print (D18), and the pie, radial and radar skeleton shapes
  // measured 784 bytes over the stylesheet (15840 to 16624). The ceiling keeps about 100 bytes of
  // headroom.
  // Raised again from 16724 on 2026-11-05. The pie's rules: the layers over the cell with the pop's
  // room and the outside labels' gutter, the slices' seam, pop, dims and their state rules keyed on
  // data-sector, the labels and leaders, the centre's square with its reels, the Track and the
  // Glow, which measured 1513 bytes over the stylesheet (16624 to 18137). The ceiling keeps about
  // 100 bytes of headroom.
  // Raised again from 18237 on 2026-11-05. The rings' strokes, dots, masks and faint dots, their
  // hover scale and dims keyed on data-ring, the tracks' scale-out keyframes, and
  // --chart-ring-fill's registration, which measured 675 bytes over the stylesheet (18137 to
  // 18812). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 18912 on 2026-11-05. The radar's rings, zero ring, spokes and hand, its
  // Area, Line and Dots looks, the hover, selection and highlight dims keyed on data-radar-series,
  // the Glow, both axes' labels, the grid's scale-outs and the labels' fade, and the forced-colour
  // rules, which measured 1298 bytes over the stylesheet (18812 to 20110). The ceiling keeps about
  // 100 bytes of headroom.
  // Raised again from 20210 on 2026-11-05. The clock's grid, its line, area and column looks with
  // their masks, the wedges' steps and past fade, its dots, hands, references, labels with their
  // width buckets, centre, dims, glow and forced-colour rules, and the radar's and clock's stop
  // colours, which measured 1744 bytes over the stylesheet (20110 to 21854). The ceiling keeps
  // about 100 bytes of headroom.
  // Raised again from 21954 on 2026-11-05. The feel pass: the ring values' chips and the Now label's
  // chip, the radar's spoke labels in the dial's width buckets, the room above and below a dial
  // for its 12 o'clock label, the spanning parts that give the side columns no width, the side
  // legend that drops under a narrow dial, the centre values that scale and wrap in their hole, and
  // the inside labels' on-colour shares, which measured 960 bytes over the stylesheet (21854 to
  // 22814). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 22914 on 2026-11-05, fix round 2: the Area's estimated stretch in its own value
  // paint through the quality mask, with the mask's ink (B2), which measured 80 bytes over the
  // stylesheet (22868 to 22948). The ceiling keeps about 100 bytes of headroom.
  // Raised again from 23048 on 2026-11-05, fix round 3: each Root's state flags and their reset,
  // the hover rules listed once per Root depth so a hover restyles only its parts, and the
  // orientation rules keyed on the parts that carry it (B6), which measured 1089 bytes over the
  // stylesheet (22948 to 24037). The ceiling keeps about 100 bytes of headroom.
  // Phase M on 2026-11-06: the polar Root's angle follower and its paced turn, the tooltip's side
  // lanes, the pick's dead band and near hold, the centre's fit guard and breakable value, the
  // labels' ray placement and ink measure, the dots' curve reads and the hatch by pixel column
  // (MOTION-REVIEW R1 to R4, F5 to F11), 24037 to 24859. The ceiling keeps about 100 bytes of
  // headroom.
  { name: "chart.css", file: "chart.css", measuredGzip: 10089, ceilingGzip: 24959 },
] satisfies readonly Measured<CssBudget>[]);

export const FLAG_RAW_BUDGETS: readonly FlagRawBudget[] = [
  { name: "flags/*.svg", ceilingBytes: FLAG_RAW_CEILING_BYTES },
];

export function budgetFailure(name: string, bytes: number, ceiling: number): string | undefined {
  if (bytes <= ceiling) {
    return undefined;
  }
  return `${name} ${bytes} bytes exceeds ceiling ${ceiling}`;
}
