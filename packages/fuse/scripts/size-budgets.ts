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
  { name: "chart", entryFile: "chart.js", measuredGzip: 97044, ceilingGzip: 164000 },
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
  // 2026-11-09: skeleton measured 21471 once SkeletonReveal joined Skeleton in the entry, bringing
  // Base UI's useRender and mergeProps, the locale dictionary, the ghost measuring, the pane swap
  // with its fade and height owners and shared geometry reader, and the form, Field, label and
  // overlay exclusion, which reads Base UI's Field and labelable wiring. Main, whose row still
  // records 8753, re-measured 9067 the same day, so the change adds 12404 and the ceiling rises by
  // that delta, from 13052.
  { name: "skeleton", entryFile: "skeleton.js", measuredGzip: 21471, ceilingGzip: 25456 },
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
    ceilingGzip: 150267,
  },
  {
    name: "chart/BarChart",
    entryFile: "chart.js",
    exportName: "BarChart",
    measuredGzip: 95989,
    ceilingGzip: 150269,
  },
  { name: "chart/PieChart", entryFile: "chart.js", exportName: "PieChart", measuredGzip: 79885 },
  { name: "chart/RadialChart", entryFile: "chart.js", exportName: "RadialChart", measuredGzip: 79858 },
  { name: "chart/RadarChart", entryFile: "chart.js", exportName: "RadarChart", measuredGzip: 79820 },
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
    ceilingGzip: 78644,
  },
  {
    name: "chart/PieChart.Root",
    entryFile: "chart.js",
    exportName: "PieChart",
    members: ["Root"],
    measuredGzip: 404,
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
  { name: "chart.css", file: "chart.css", measuredGzip: 10089, ceilingGzip: 15940 },
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
