import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { lintFixtures, removeTrees, sorted } from "./lint-fixtures.mjs";

/**
 * Each rule of the repository's `fuse` oxlint plugin, and each built-in rule the configuration
 * scopes to a moved contract, fires on a violating fixture and stays quiet on a valid one.
 */

/** @typedef {import("./lint-fixtures.mjs").Fixture} Fixture */

const HARNESS = "fuse(browser-suite-harness)";
const NO_TIMER = "eslint(no-restricted-globals)";
const LOCATOR = "fuse(locate-by-role)";
const RING = "fuse(no-ring-shadow-in-suites)";
const DISPLAY_NAME = "fuse(chart-part-display-name)";
const PLACEMENT = "fuse(chart-motion-placement)";
const WRITER = "fuse(chart-motion-writer)";
const COLOUR = "fuse(no-chart-colour-literal)";
const REF = "fuse(no-ref-snapshot-path)";
const USER_AGENT = "fuse(no-retired-user-agent-api)";
const OVERLAY = "fuse(overlay-classes-owner)";
const STRING_TAG = "fuse(no-object-string-tag)";
const PREVIEW_MENU = "fuse(base-ui-preview-menu)";
const WIRING = "fuse(render-element-wiring)";
const ASSET = "fuse(server-safe-asset)";
const TITLE_SLOT = "fuse(asset-title-slot)";
const RESTRICTED_IMPORT = "eslint(no-restricted-imports)";
const REQUIRED_IMPORT = "fuse(required-import)";
const MODULE_NAME = "fuse(no-vague-module-name)";

const SUITE = "packages/fuse/src/components/probe/probe.browser.test.tsx";
const CHART = "packages/fuse/src/components/chart";
const HARNESS_IMPORT = 'import { render } from "../../../test/themed-browser-render";';

/** Sixteen blank lines: a locator below them sits outside a DOM audit comment's window above. */
const WINDOW = Array.from({ length: 16 }, () => "");

/** @type {readonly Fixture[]} */
const FIXTURES = [
  {
    name: "browser-suite-harness and the timer ban fire on a suite that skips the harness, copies a fixture and waits on a timer",
    path: SUITE,
    lines: [
      'import { render } from "../../../test/browser-render";',
      'import { tkasCompany } from "../../../test/theme-browser-fixtures";',
      "const fkasPrivate = tkasCompany;",
      "setTimeout(() => render(fkasPrivate), 10);",
      "window.setTimeout(() => render(fkasPrivate), 10);",
      "globalThis.setTimeout(() => render(fkasPrivate), 10);",
    ],
    reports: [
      `${HARNESS}:1`,
      `${HARNESS}:2`,
      `${HARNESS}:3`,
      `${NO_TIMER}:4`,
      `${NO_TIMER}:5`,
      `${NO_TIMER}:6`,
    ],
  },
  {
    name: "browser-suite-harness stays quiet on a react-aria suite that mounts through the harness and waits on frames",
    path: "packages/fuse/src/react-aria/probe/probe.browser.test.tsx",
    lines: [
      'import { render } from "../../../test/themed-browser-render";',
      'import { nextFrames } from "../../../test/animation-frames";',
      'import { fkasPrivate } from "../../../test/theme-fixtures";',
      "await nextFrames(2);",
      "render(fkasPrivate);",
    ],
    reports: [],
  },
  {
    name: "browser-suite-harness lets a hooks probe take the plain harness",
    path: "packages/fuse/src/hooks/probe.browser.test.tsx",
    lines: ['import { render } from "../../test/browser-render";', "render(null);"],
    reports: [],
  },
  {
    name: "browser-suite-harness and the timer ban stay out of unit tests and the styles suites",
    path: "packages/fuse/src/components/probe/probe.test.tsx",
    lines: ["setTimeout(() => undefined, 10);"],
    reports: [],
  },
  {
    name: "browser-suite-harness, the timer ban and locate-by-role stay out of the styles suites",
    path: "packages/fuse/src/styles/probe.browser.test.tsx",
    lines: ['document.querySelector("[data-slot=card]");', "setTimeout(() => undefined, 10);"],
    reports: [],
  },
  {
    name: "locate-by-role fires on each undocumented slot, document-root and star locator, and not on a documented one",
    path: "packages/fuse/src/components/probe/locators.browser.test.tsx",
    lines: [
      HARNESS_IMPORT,
      'document.querySelector("[data-slot=card]");',
      "// DOM audit: every card part exposes its slot.",
      'document.querySelector("[data-slot=card]");',
      ...WINDOW,
      'document.body.querySelector("input");',
      '// document.querySelector("[data-slot=card]") in a comment is prose.',
      "element.closest('[data-slot=\"card\"]');",
      'container.querySelectorAll("*");',
      "element.dataset.slot;",
      "function bySlot() {}",
      "// DOM audit:",
      'document.documentElement.querySelectorAll("style");',
      'document.head.querySelector("style"); // DOM audit: the injected sheet is the contract.',
    ],
    reports: [
      `${LOCATOR}:2`,
      `${LOCATOR}:21`,
      `${LOCATOR}:23`,
      `${LOCATOR}:24`,
      `${LOCATOR}:25`,
      `${LOCATOR}:26`,
      `${LOCATOR}:28`,
    ],
  },
  {
    name: "locate-by-role reads the shared browser fixtures under test/",
    path: "packages/fuse/test/probe-locators.ts",
    lines: ['export const card = () => document.querySelector("[data-slot=card]");'],
    reports: [`${LOCATOR}:1`],
  },
  {
    name: "no-ring-shadow-in-suites fires on a component suite that reads the ring shadow, in code or prose",
    path: "packages/fuse/src/components/probe/ring.test.ts",
    lines: [
      'expect(getComputedStyle(element).getPropertyValue("--tw-ring-shadow")).toBe("");',
      "// --tw-ring-shadow stays with the helper.",
    ],
    reports: [`${RING}:1`, `${RING}:2`],
  },
  {
    name: "no-ring-shadow-in-suites leaves the shared helper under test/ alone",
    path: "packages/fuse/test/probe-ring.ts",
    lines: ['export const ring = "--tw-ring-shadow";'],
    reports: [],
  },
  {
    name: "chart-part-display-name fires on a displayName assignment and on an exported part without Object.assign",
    path: `${CHART}/probe-part.tsx`,
    lines: [
      "/** @beta */",
      "export function ProbePart() { return null; }",
      'ProbePart.displayName = "ProbePart";',
    ],
    reports: [`${DISPLAY_NAME}:2`, `${DISPLAY_NAME}:3`],
  },
  {
    name: "chart-part-display-name stays quiet on a @beta part named through an Object.assign initializer",
    path: `${CHART}/probe-assigned.tsx`,
    lines: [
      "/** @beta */",
      'export const ProbePart = Object.assign(function ProbePart() { return null; }, { displayName: "ProbePart" });',
      "export function probeHelper() { return 1; }",
    ],
    reports: [],
  },
  {
    name: "chart-part-display-name stays out of chart tests",
    path: `${CHART}/probe-part.test.tsx`,
    lines: ["export function ProbePart() { return null; }", 'ProbePart.displayName = "ProbePart";'],
    reports: [],
  },
  {
    name: "chart-part-display-name stays out of other components",
    path: "packages/fuse/src/components/card/probe-part.tsx",
    lines: ["export function ProbePart() { return null; }", 'ProbePart.displayName = "ProbePart";'],
    reports: [],
  },
  {
    name: "chart-motion-placement fires on a direct placement, a named placement kind and an unasked registration",
    path: `${CHART}/probe-motion.ts`,
    lines: [
      'motion.place(node, { kind: "move" });',
      "function write() {}",
      "export function useProbe() { useMotionMark(motion, write, look, []); }",
    ],
    reports: [`${PLACEMENT}:1`, `${PLACEMENT}:1`, `${PLACEMENT}:1`],
  },
  {
    name: "chart-motion-placement lets the loop place marks and name placement kinds",
    path: `${CHART}/chart-motion.ts`,
    lines: ['motion.place(node, { kind: "settle" });'],
    reports: [],
  },
  {
    name: "chart-motion-placement stays out of chart tests",
    path: `${CHART}/probe-motion.test.ts`,
    lines: ['motion.place(node, { kind: "move" });'],
    reports: [],
  },
  {
    name: "chart-motion-writer fires on inline, component-bound, shadowing and non-forwarded writers",
    path: `${CHART}/probe-writers.ts`,
    lines: [
      "function write() {}",
      "export function Inline() { useMotionMark(motion, (node) => node, look, []); }",
      "export function Nested() { const write = () => {}; useMotionMark(motion, write, look, []); }",
      "export function Param({ write }) { useMotionMark(motion, write, look, []); }",
      "export function Block() { if (on) { let write = () => {}; useMotionMark(motion, write, look, []); } }",
      "export function Hoisted() { useMotionMark(motion, write, look, []); if (on) { var write = () => {}; } }",
      "export function Caught() { try {} catch (write) { useMotionMark(motion, write, look, []); } }",
      "export function Mark(draw) { useMotionMark(motion, draw, look, []); }",
      "export function usePathMark(write, draw) { useMotionMark(motion, draw, look, []); }",
      "export function Undeclared() { useMotionMark(motion, missing, look, []); }",
    ],
    // The nine unasked registrations leave the module nine classifier calls short.
    reports: [
      `${PLACEMENT}:1`,
      `${WRITER}:2`,
      `${WRITER}:3`,
      `${WRITER}:4`,
      `${WRITER}:5`,
      `${WRITER}:6`,
      `${WRITER}:7`,
      `${WRITER}:8`,
      `${WRITER}:9`,
      `${WRITER}:10`,
    ],
  },
  {
    name: "chart-motion-writer and chart-motion-placement stay quiet on module-scope, imported and forwarded writers that each ask once",
    path: `${CHART}/probe-module-writers.ts`,
    lines: [
      'import { writeBar } from "./probe-bar-writer";',
      "function write() {}",
      "export function Top() { useMotionMark(motion, write, look, []); useCommitMotion(commit); }",
      "export function Imported() { useMotionMark(motion, writeBar, look, []); useCommitMotion(commit); }",
      "export function usePathMark(draw, input) { useMotionMark(motion, draw, look, []); useFollowerPlacement(input); }",
      "export function Other() { { const other = 1; } useMotionMark(motion, write, look, []); useCommitMotion(commit); }",
      "export function Bar() { usePathMark(write, input); }",
    ],
    reports: [],
  },
  {
    name: "no-chart-colour-literal fires on hex and colour-function literals in chart code",
    path: `${CHART}/probe-colour.ts`,
    lines: [
      'export const fill = "#ff0000";',
      'export const stroke = "oklch(0.5 0.1 200)";',
      "// #fff in a comment is prose.",
    ],
    reports: [`${COLOUR}:1`, `${COLOUR}:2`],
  },
  {
    name: "no-chart-colour-literal stays quiet on custom properties",
    path: `${CHART}/probe-paint.ts`,
    lines: ['export const fill = "var(--chart-color-price)";', "// #fff in a comment is prose."],
    reports: [],
  },
  {
    name: "no-chart-colour-literal stays out of chart tests",
    path: `${CHART}/probe-paint.test.ts`,
    lines: ['export const fill = "#ff0000";'],
    reports: [],
  },
  {
    name: "the package-source spelling bans fire on .ref/, the retired user-agent API, a [object String] tag and overlay classes",
    path: "packages/fuse/src/components/probe/spellings.ts",
    lines: [
      "// Ported from .ref/base-ui.",
      "export const agent = navigator.userAgent;",
      'export type Parsed = import("@elmeragroup/lib").UserAgentParserResult;',
      'export const isText = (value: unknown) => Object.prototype.toString.call(value) === "[object String]";',
      "// [object String] in a comment is prose.",
      'export const popup = "z-50 bg-popover text-popover-foreground";',
      "// z-60 in a comment is prose.",
    ],
    reports: [
      `${REF}:1`,
      `${USER_AGENT}:2`,
      `${USER_AGENT}:3`,
      `${USER_AGENT}:3`,
      `${STRING_TAG}:4`,
      `${OVERLAY}:6`,
      `${OVERLAY}:6`,
    ],
  },
  {
    name: "the package-source spelling bans stay out of tests",
    path: "packages/fuse/src/components/probe/spellings.test.ts",
    lines: ['import "./.ref/base-ui";', 'export const popup = "z-50";', "navigator.userAgent;"],
    reports: [],
  },
  {
    name: "overlay-classes-owner holds the owner to one spelling of each layer",
    path: "packages/fuse/src/components/overlay/overlay-classes.ts",
    lines: [
      'export const overlayLayer = "z-50";',
      'export const dialogLayer = "z-50";',
      'export const fill = "bg-popover text-popover-foreground";',
    ],
    // One report for the doubled z-50 and one for the missing z-60.
    reports: [`${OVERLAY}:1`, `${OVERLAY}:1`],
  },
  {
    name: "base-ui-preview-menu fires on each preview member read through any alias of Menu, in code, types and JSX",
    path: "packages/fuse/src/components/probe/menu.tsx",
    lines: [
      'import { Menu as M } from "@base-ui/react/menu";',
      'import { Menu } from "@base-ui/react";',
      "M.FilterProvider; M.Item; M.useFilter;",
      "Menu.Clear;",
      "export type Props = M.Empty.Props;",
      "export const list = <M.List />;",
    ],
    reports: [
      `${PREVIEW_MENU}:3`,
      `${PREVIEW_MENU}:3`,
      `${PREVIEW_MENU}:4`,
      `${PREVIEW_MENU}:5`,
      `${PREVIEW_MENU}:6`,
    ],
  },
  {
    name: "base-ui-preview-menu holds the searchable menu to every preview part it wraps",
    path: "packages/fuse/src/components/data-table-filter/searchable-menu.ts",
    lines: ['import { Menu } from "@base-ui/react/menu";', "export const input = Menu.Input;"],
    // FilterProvider, List and Empty are no longer read, so a rename of them would go unseen.
    reports: [`${PREVIEW_MENU}:1`, `${PREVIEW_MENU}:1`, `${PREVIEW_MENU}:1`],
  },
  {
    name: "base-ui-preview-menu ignores a Menu that is not Base UI's",
    path: "packages/fuse/src/components/probe/local-menu.ts",
    lines: ['import { Menu } from "./menu";', "export const input = Menu.Input;"],
    reports: [],
  },
  {
    name: "render-element-wiring fires on state, wiring and spreads on an inline render element",
    path: "packages/fuse/src/components/probe/render.tsx",
    lines: [
      "export const input = <P.Input render={<Group disabled={false} aria-label={name} className={c} />} />;",
      "export const control = <Control render={<Textarea {...props} />} />;",
      'export const icon = <P.Icon render={<span className="x" />} />;',
    ],
    reports: [`${WIRING}:1`, `${WIRING}:1`, `${WIRING}:2`],
  },
  {
    name: "render-element-wiring stays inside components/",
    path: "packages/fuse/src/react-aria/probe/render.tsx",
    lines: ["export const input = <P.Input render={<Group disabled={false} />} />;"],
    reports: [],
  },
  {
    name: "server-safe-asset fires on a client directive, a hook import and hook calls in a bespoke icon",
    path: "packages/fuse/src/icons/bespoke/probe-logo.tsx",
    lines: [
      '"use client";',
      'import { useId } from "react";',
      "export function ProbeLogo() { return <svg id={React.useId()} key={useId()} />; }",
    ],
    reports: [`${ASSET}:1`, `${ASSET}:2`, `${ASSET}:3`, `${ASSET}:3`],
  },
  {
    name: "server-safe-asset reads the illustrations too, which asset-title-slot leaves alone",
    path: "packages/fuse/src/illustrations/probe-meter.tsx",
    lines: ["export function ProbeMeter() { return <svg key={useId()}><title>Meter</title></svg>; }"],
    reports: [`${ASSET}:1`],
  },
  {
    name: "server-safe-asset and asset-title-slot stay quiet on a hook-free asset named through its title slot",
    path: "packages/fuse/src/icons/bespoke/probe-mark.tsx",
    lines: [
      "export function ProbeMark({ title }: { title?: string }) {",
      "  return <svg>{title ? <title>{title}</title> : null}</svg>;",
      "}",
    ],
    reports: [],
  },
  {
    name: "asset-title-slot fires on a static title and a title element that is not the bare slot",
    path: "packages/fuse/src/icons/bespoke/probe-titled.tsx",
    lines: [
      "export function ProbeTitled({ title }: { title?: string }) {",
      "  return (",
      "    <svg>",
      "      <title>Probe</title>",
      '      <title lang="en">{title}</title>',
      "      <title>{title} logo</title>",
      "    </svg>",
      "  );",
      "}",
    ],
    reports: [`${TITLE_SLOT}:4`, `${TITLE_SLOT}:5`, `${TITLE_SLOT}:6`],
  },
  {
    name: "server-safe-asset stays outside the bespoke and illustration folders",
    path: "packages/fuse/src/icons/create-probe-icon.tsx",
    lines: ['"use client";', "export function ProbeIcon() { return <svg key={useId()} />; }"],
    reports: [],
  },
  {
    name: "the build-script import ban fires when build.ts imports the source-export writer",
    path: "packages/fuse/scripts/build.ts",
    lines: [
      'import { writePublishManifest, writeSourceExports } from "./generate-exports";',
      'import "./write-source-exports.ts";',
      "writePublishManifest(writeSourceExports);",
    ],
    reports: [`${RESTRICTED_IMPORT}:1`, `${RESTRICTED_IMPORT}:2`],
  },
  {
    name: "locate-by-role reads a locator across lines, takes no exemption from audit text in a string, and ignores query code in a string",
    path: "packages/fuse/src/components/probe/multiline.browser.test.tsx",
    lines: [
      HARNESS_IMPORT,
      "host.querySelector(",
      '  "[data-slot=card]"',
      ");",
      'const note = "// DOM audit: the card slot is public.";',
      'host.querySelector("[data-slot=card]");',
      "const example = 'document.querySelector(\"[data-slot=card]\")';",
    ],
    reports: [`${LOCATOR}:2`, `${LOCATOR}:6`],
  },
  {
    name: "locate-by-role reads a slot selector held in a constant and honours a multi-line audit comment",
    path: "packages/fuse/src/components/probe/constant.browser.test.tsx",
    lines: [
      HARNESS_IMPORT,
      'const CARD = "[data-slot=card]";',
      "host.querySelector(CARD);",
      "/**",
      " * DOM audit: the card slot is the contract under test.",
      " */",
      "host.querySelector(CARD);",
    ],
    reports: [`${LOCATOR}:3`],
  },
  {
    name: "chart-part-display-name judges each @beta part by its own Object.assign",
    path: `${CHART}/probe-unrelated-assign.tsx`,
    lines: [
      "/** @beta */",
      "export function ProbePart() { return null; }",
      "Object.assign({}, {});",
      "/** @beta */",
      "export function ProbeOther() { return null; }",
      'Object.assign(ProbeNamed, { displayName: "Chart.ProbeNamed" });',
      "/** @beta */",
      "export const ProbeConst = Object.assign(function ProbeConst() { return null; }, {});",
      "/** A part promoted out of preview keeps the rule. @public */",
      "export function ProbePublic() { return null; }",
    ],
    reports: [`${DISPLAY_NAME}:2`, `${DISPLAY_NAME}:5`, `${DISPLAY_NAME}:8`, `${DISPLAY_NAME}:10`],
  },
  {
    name: "chart-part-display-name stays quiet on a @beta part named after its declaration and on untagged shared components and hooks",
    path: `${CHART}/probe-named-parts.tsx`,
    lines: [
      "/** The probe part.\n * @beta\n */",
      "export function ChartProbe() { return null; }",
      "/** A shared swatch, no release tag. */",
      "export function ProbeSwatch() { return null; }",
      "export function useProbe() { return 1; }",
      'Object.assign(ChartProbe, { displayName: "Chart.Probe" });',
    ],
    reports: [],
  },
  {
    name: "chart-motion-placement reads an optional placement call and a template placement kind",
    path: `${CHART}/probe-optional-place.ts`,
    lines: ["motion?.place(node, { kind: `move` });", "context.motion.place(node, { kind: 'settle' });"],
    reports: [`${PLACEMENT}:1`, `${PLACEMENT}:1`, `${PLACEMENT}:2`, `${PLACEMENT}:2`],
  },
  {
    name: "chart-motion-placement counts a registration with nested type arguments",
    path: `${CHART}/probe-typed-mark.ts`,
    lines: [
      "function write() {}",
      "export function Typed() { useMotionMark<Readonly<Look>>(motion, write, look, []); useCommitMotion(commit); }",
    ],
    reports: [],
  },
  {
    name: "chart-motion-placement and chart-motion-writer read an aliased useMotionMark",
    path: `${CHART}/probe-aliased-mark.ts`,
    lines: [
      'import { useMotionMark as mark } from "./chart-motion-mark";',
      "export function Aliased() { mark(motion, (node) => node, look, []); }",
    ],
    reports: [`${PLACEMENT}:1`, `${WRITER}:2`],
  },
  {
    name: "chart-motion-placement and chart-motion-writer follow a loop held in a constant and hooks read off a namespace import",
    path: `${CHART}/probe-namespaced-mark.ts`,
    lines: [
      'import * as Marks from "./chart-motion-mark";',
      "const loop = context.motion;",
      "loop.place(node, placement);",
      "export function Namespaced() { Marks.useMotionMark(motion, (node) => node, look, []); }",
    ],
    reports: [`${PLACEMENT}:1`, `${PLACEMENT}:3`, `${WRITER}:4`],
  },
  {
    name: "base-ui-preview-menu resolves Menu to its binding, so a shadowing parameter is not Base UI's",
    path: "packages/fuse/src/components/probe/shadowed-menu.tsx",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function local(Menu) { return Menu.Input; }",
      "export const real = Menu.List;",
      "export const element = <Menu.Empty />;",
      'import * as Base from "@base-ui/react";',
      "export const namespaced = Base.Menu.Input;",
      "export function typed(Menu: unknown): Menu.Clear.Props { return Menu; }",
    ],
    reports: [`${PREVIEW_MENU}:3`, `${PREVIEW_MENU}:4`, `${PREVIEW_MENU}:6`, `${PREVIEW_MENU}:7`],
  },
  {
    name: "server-safe-asset reads the imported name of an aliased hook and its calls",
    path: "packages/fuse/src/icons/bespoke/probe-alias.tsx",
    lines: [
      'import { useId as makeId } from "react";',
      "export function ProbeAlias() { return <svg id={makeId()} />; }",
      "const { useState } = React;",
      "export function ProbeLocal() { useState(); return null; }",
    ],
    reports: [`${ASSET}:1`, `${ASSET}:2`, `${ASSET}:4`],
  },
  {
    name: "render-element-wiring reads each branch of a conditional render element",
    path: "packages/fuse/src/components/probe/render-branches.tsx",
    lines: [
      "export const input = <P.Input render={open ? <Group disabled /> : <Group />} />;",
      "export const other = <P.Input render={open && <Group id={id} />} />;",
    ],
    reports: [`${WIRING}:1`, `${WIRING}:2`],
  },
  {
    name: "browser-suite-harness fires on a destructured fkasPrivate copy",
    path: "packages/fuse/src/components/probe/destructured.browser.test.tsx",
    lines: [HARNESS_IMPORT, "const { fkasPrivate } = themes;"],
    reports: [`${HARNESS}:2`],
  },
  {
    name: "required-import fires on an is-text-node caller that names the owner only in a comment",
    path: "packages/fuse/src/components/checkbox/checkbox.tsx",
    lines: ["// isTextNode comes from ../../internal/is-text-node.", "export const probe = 1;"],
    // The report sits on the program, which starts at its first statement, below the comment.
    reports: [`${REQUIRED_IMPORT}:2`],
  },
  {
    name: "required-import fires on an is-text-node caller whose only import of the owner is type-only",
    path: "packages/fuse/src/components/confirm-button/confirm-button.tsx",
    lines: ['import type { isTextNode } from "../../internal/is-text-node";', "export const probe = 1;"],
    reports: [`${REQUIRED_IMPORT}:1`],
  },
  {
    name: "required-import stays quiet on an is-text-node caller that imports the owner",
    path: "packages/fuse/src/react-aria/grid-list/grid-list.tsx",
    lines: ['import { isTextNode } from "../../internal/is-text-node";', "export const probe = isTextNode;"],
    reports: [],
  },
  {
    name: "chart-motion-writer and chart-motion-placement fire in the owner when a hook they key on is renamed",
    path: `${CHART}/chart-motion-mark.ts`,
    lines: [
      "export function useMark(motion, write: MotionWriter<T, L>, look, axes) {}",
      "export function useCommitMotion(commit) {}",
      "export function useFollowerPlacement(input) {}",
    ],
    // useMotionMark is both a writer hook and the registration the classifiers pair with.
    reports: [`${WRITER}:1`, `${PLACEMENT}:1`],
  },
  {
    name: "chart-motion-writer fires in the owner when a writer hook's writer parameter moves or goes",
    path: `${CHART}/chart-series-path.ts`,
    lines: [
      "export function usePathMark(input, draw: MotionWriter<G, L>) {}",
      "export function useSeries(part, draw: MotionWriter<G, L>) {}",
    ],
    reports: [`${WRITER}:1`, `${WRITER}:1`],
  },
  {
    name: "chart-motion-writer resolves a writer in the value namespace, past a type of the same name",
    path: `${CHART}/probe-type-shadow.ts`,
    lines: [
      "function write() {}",
      "export function Typed() { type write = unknown; useMotionMark(motion, write, look, []); useCommitMotion(commit); }",
    ],
    reports: [],
  },
  {
    name: "base-ui-preview-menu resolves a value read past a local type of the same name",
    path: "packages/fuse/src/components/probe/type-shadow-menu.tsx",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function local() { type Menu = unknown; return Menu.Input; }",
    ],
    reports: [`${PREVIEW_MENU}:2`],
  },
  {
    name: "base-ui-preview-menu reads Menu off a namespace import alike in code, JSX and types",
    path: "packages/fuse/src/components/probe/namespace-menu.tsx",
    lines: [
      'import * as Base from "@base-ui/react";',
      "export const input = Base.Menu.Input;",
      "export const element = <Base.Menu.Input />;",
      "export type Props = Base.Menu.Input.Props;",
      "export const root = Base.Menu.Root;",
    ],
    reports: [`${PREVIEW_MENU}:2`, `${PREVIEW_MENU}:3`, `${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads a typeof query in the value namespace, past a local type of the same name",
    path: "packages/fuse/src/components/probe/typeof-menu.ts",
    lines: [
      'import type { Menu } from "@base-ui/react/menu";',
      "export function useProbe() {",
      "  type Menu = { label: string };",
      "  type Input = typeof Menu.Input;",
      "  return (input: Input, item: Menu) => ({ input, label: item.label });",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads a typeof query off a namespace import past a local type of the same name",
    path: "packages/fuse/src/components/probe/typeof-namespace.ts",
    lines: [
      'import * as Base from "@base-ui/react";',
      "export function useProbe() {",
      "  type Base = { label: string };",
      "  type Input = typeof Base.Menu.Input;",
      "  return (input: Input, item: Base) => ({ input, label: item.label });",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu lets a typeof query read a local value that shadows Menu",
    path: "packages/fuse/src/components/probe/typeof-local.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function useProbe(Menu: { readonly Input: number }) {",
      "  type Input = typeof Menu.Input;",
      "  const input: Input = Menu.Input;",
      "  return input;",
      "}",
      "export const root = Menu.Root;",
    ],
    reports: [],
  },
  {
    name: "base-ui-preview-menu reads a heritage clause in the type namespace, past a local value of the same name",
    path: "packages/fuse/src/components/probe/heritage-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function useProbe() {",
      "  const Menu = { label: 1 };",
      "  interface Props extends Menu.Input.Props {}",
      "  return (props: Props) => [props, Menu.label];",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads an import = entity name in the namespace meaning, past a local type of the same name",
    path: "packages/fuse/src/components/probe/import-equals-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react";',
      "export namespace Preview {",
      "  export type Menu = { label: string };",
      "  export import Input = Menu.Input;",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads a qualified type reference in the namespace meaning, past a local type of the same name",
    path: "packages/fuse/src/components/probe/type-reference-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function probe() {",
      "  type Menu = { label: string };",
      "  type Props = Menu.Input.Props;",
      "  return (props: Props, item: Menu) => [props, item.label];",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads the type a type predicate names in the namespace meaning, past a local type of the same name",
    path: "packages/fuse/src/components/probe/predicate-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function probe() {",
      "  type Menu = { label: string };",
      "  const isProps = (value: unknown): value is Menu.Input.Props => value !== null;",
      "  return (item: Menu) => [isProps, item.label];",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads an implements clause in the namespace meaning, past a local value of the same name",
    path: "packages/fuse/src/components/probe/implements-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function probe() {",
      "  const Menu = { label: 1 };",
      "  class Props implements Menu.Input.Props {}",
      "  return [Props, Menu.label];",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`],
  },
  {
    name: "base-ui-preview-menu reads a superclass and a decorator as values, past a local type of the same name",
    path: "packages/fuse/src/components/probe/value-heritage-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export function probe() {",
      "  type Menu = { label: string };",
      "  @Menu.Input class Decorated {}",
      "  class Extended extends Menu.List {}",
      "  return (item: Menu) => [Decorated, Extended, item.label];",
      "}",
    ],
    reports: [`${PREVIEW_MENU}:4`, `${PREVIEW_MENU}:5`],
  },
  {
    name: "base-ui-preview-menu reads an export = entity name",
    path: "packages/fuse/src/components/probe/export-equals-menu.ts",
    lines: ['import { Menu } from "@base-ui/react/menu";', "export = Menu.Input;"],
    reports: [`${PREVIEW_MENU}:2`],
  },
  {
    name: "base-ui-preview-menu reads Menu through an import type qualifier of either entry, and leaves the Menu of another module alone",
    path: "packages/fuse/src/components/probe/import-type-menu.ts",
    lines: [
      'export type Input = import("@base-ui/react/menu").Menu.Input;',
      'export type Query = typeof import("@base-ui/react").Menu.Empty;',
      'export type Local = import("./menu").Menu.Input;',
    ],
    reports: [`${PREVIEW_MENU}:1`, `${PREVIEW_MENU}:2`],
  },
  {
    name: "base-ui-preview-menu reads a computed member and an indexed access of the Menu type",
    path: "packages/fuse/src/components/probe/computed-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      'export const input = Menu["Input"];',
      'export type Indexed = (typeof Menu)["List"];',
      'export const root = Menu["Root"];',
    ],
    reports: [`${PREVIEW_MENU}:2`, `${PREVIEW_MENU}:3`],
  },
  {
    name: "base-ui-preview-menu resolves a qualified type to a local namespace that shadows Menu",
    path: "packages/fuse/src/components/probe/local-namespace-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export namespace Local {",
      "  namespace Menu { export namespace Input { export type Props = string; } }",
      "  export type Props = Menu.Input.Props;",
      "}",
      "export const root = Menu.Root;",
    ],
    reports: [],
  },
  {
    name: "base-ui-preview-menu reads past a local namespace with no value: type-only, nested type-only, declared type-only, merged type-only and empty",
    path: "packages/fuse/src/components/probe/uninstantiated-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export namespace TypeOnly {",
      "  namespace Menu { export interface X {} }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace NestedTypeOnly {",
      "  namespace Menu { export namespace Inner { export interface X {} } }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace DeclaredTypeOnly {",
      "  declare namespace Menu { interface X {} }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace MergedTypeOnly {",
      "  namespace Menu { export interface X {} }",
      "  namespace Menu { export type Y = string; }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace Empty {",
      "  namespace Menu {}",
      "  export const input = Menu.Input;",
      "}",
      "export namespace DottedTypeOnly {",
      "  namespace Menu.Inner { export interface X {} }",
      "  export const input = Menu.Input;",
      "}",
    ],
    reports: [
      `${PREVIEW_MENU}:4`,
      `${PREVIEW_MENU}:8`,
      `${PREVIEW_MENU}:12`,
      `${PREVIEW_MENU}:17`,
      `${PREVIEW_MENU}:21`,
      `${PREVIEW_MENU}:25`,
    ],
  },
  {
    name: "base-ui-preview-menu lets an instantiated local namespace shadow Menu: a value, a nested value, a const enum, a declared function, a merged value",
    path: "packages/fuse/src/components/probe/instantiated-menu.ts",
    lines: [
      'import { Menu } from "@base-ui/react/menu";',
      "export namespace WithValue {",
      "  namespace Menu { export const x = 1; }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace NestedInstantiated {",
      "  namespace Menu { export namespace Inner { export const x = 1; } }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace ConstEnumOnly {",
      "  namespace Menu { export const enum K { A } }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace DeclaredFunction {",
      "  declare namespace Menu { function f(): void; }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace MergedValue {",
      "  namespace Menu { export interface X {} }",
      "  namespace Menu { export const y = 1; }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace DottedValue {",
      "  namespace Menu.Inner { export const x = 1; }",
      "  export const input = Menu.Input;",
      "}",
      "export namespace DottedType {",
      "  namespace Menu.Inner { export interface X {} }",
      "  export type Input = Menu.Input;",
      "}",
    ],
    reports: [],
  },
  {
    name: "server-safe-asset reads hooks taken off a default or namespace import",
    path: "packages/fuse/src/icons/bespoke/probe-extracted.tsx",
    lines: [
      'import React from "react";',
      'import * as R from "react";',
      "const { useId: makeId } = React;",
      "const grab = R.useState;",
      "export function ProbeExtracted() { grab(); return <svg id={makeId()} />; }",
    ],
    reports: [`${ASSET}:3`, `${ASSET}:4`, `${ASSET}:5`, `${ASSET}:5`],
  },
  {
    name: "required-import, the client directive and the Phosphor import bans fire on an icon helper that drops its SSR Check import",
    path: "packages/fuse/src/icons/create-elmera-icon.ts",
    lines: [
      '"use client";',
      '// The Check type comes from "@phosphor-icons/react/dist/ssr/Check".',
      'import { Check } from "@phosphor-icons/react";',
      'import "@phosphor-icons/react/dist/csr/Check";',
      "export const probe = Check;",
    ],
    reports: [`${ASSET}:1`, `${REQUIRED_IMPORT}:1`, `${RESTRICTED_IMPORT}:3`, `${RESTRICTED_IMPORT}:4`],
  },
  {
    name: "no-vague-module-name fires on a vague module name in each source tree, whatever the source extension",
    path: "apps/probe/src/helpers.ts",
    lines: ["export const helper = 1;"],
    reports: [`${MODULE_NAME}:1`],
  },
  {
    name: "no-vague-module-name fires on a vague .mjs module in tooling",
    path: "tooling/probe/common.mjs",
    lines: ["export const shared = 1;"],
    reports: [`${MODULE_NAME}:1`],
  },
  {
    name: "no-vague-module-name lets the allowlisted styles/utils.ts through",
    path: "packages/fuse/src/styles/utils.ts",
    lines: ["export const utility = 1;"],
    reports: [],
  },
  {
    name: "no-vague-module-name reads only the name before the last extension",
    path: "packages/probe/utils.test.ts",
    lines: ["export const probe = 1;"],
    reports: [],
  },
  {
    name: "no-vague-module-name leaves generated modules alone",
    path: "apps/probe/src/generated/helpers.ts",
    lines: ["export const generated = 1;"],
    reports: [],
  },
  {
    name: "no-vague-module-name stays inside the source trees",
    path: "misc.ts",
    lines: ["export const root = 1;"],
    reports: [],
  },
  {
    name: "the build-script import ban leaves the other scripts alone",
    path: "packages/fuse/scripts/write-source-exports.ts",
    lines: ['import { writeSourceExports } from "./generate-exports";', 'writeSourceExports(".");'],
    reports: [],
  },
];

/**
 * Fixtures that would collide with a path above, linted in a second tree: the quiet owner of the
 * overlay layers, and a build script that imports only the publish-manifest writer.
 *
 * @type {readonly Fixture[]}
 */
const SECOND_TREE = [
  {
    name: "overlay-classes-owner lets the owner spell each layer once and the popup classes freely",
    path: "packages/fuse/src/components/overlay/overlay-classes.ts",
    lines: [
      'export const overlayLayer = "z-50";',
      'export const toastLayer = "z-60";',
      'export const fill = "bg-popover text-popover-foreground";',
      "// Every overlay stacks at z-50 through overlayLayer.",
    ],
    reports: [],
  },
  {
    name: "the motion rules stay quiet in owners that declare every hook they key on",
    path: `${CHART}/chart-motion-mark.ts`,
    lines: [
      "export function useMotionMark(motion, write: MotionWriter<T, L>, look, axes) {}",
      "export function useCommitMotion(commit) {}",
      "export function useFollowerPlacement(input) {}",
    ],
    reports: [],
  },
  {
    name: "chart-motion-writer stays quiet in an owner whose writer hooks keep their writer parameters",
    path: `${CHART}/chart-series-path.ts`,
    lines: [
      "export function usePathMark(draw: MotionWriter<G, L>, input) {}",
      "export function useSeriesPath(part, draw: MotionWriter<G, L>) {}",
    ],
    reports: [],
  },
  {
    name: "required-import and the Phosphor import bans stay quiet on an icon helper that imports the SSR Check type",
    path: "packages/fuse/src/icons/create-elmera-icon.ts",
    lines: [
      'import type { Check } from "@phosphor-icons/react/dist/ssr/Check";',
      "export type Probe = Check;",
    ],
    reports: [],
  },
  {
    name: "base-ui-preview-menu lets the searchable menu read every preview part it wraps",
    path: "packages/fuse/src/components/data-table-filter/searchable-menu.ts",
    lines: [
      'import { Menu as MenuPrimitive } from "@base-ui/react/menu";',
      "export const parts = { Provider: MenuPrimitive.FilterProvider, Input: MenuPrimitive.Input };",
      "export const lists = { List: MenuPrimitive.List, Empty: MenuPrimitive.Empty };",
    ],
    reports: [],
  },
  {
    name: "the build-script import ban lets build.ts import the publish-manifest writer",
    path: "packages/fuse/scripts/build.ts",
    lines: ['import { writePublishManifest } from "./generate-exports";', "writePublishManifest();"],
    reports: [],
  },
];

describe("fuse lint rules under the repository configuration", () => {
  /** @type {string[]} */
  const trees = [];
  /** @type {Map<string, string[]>} */
  let first = new Map();
  /** @type {Map<string, string[]>} */
  let second = new Map();

  beforeAll(() => {
    first = lintFixtures(FIXTURES, trees);
    second = lintFixtures(SECOND_TREE, trees);
  });

  afterAll(() => {
    removeTrees(trees);
  });

  it.each(FIXTURES)("$name", ({ path, reports }) => {
    expect(first.get(path)).toEqual(sorted(reports));
  });

  it.each(SECOND_TREE)("$name", ({ path, reports }) => {
    expect(second.get(path)).toEqual(sorted(reports));
  });
});
