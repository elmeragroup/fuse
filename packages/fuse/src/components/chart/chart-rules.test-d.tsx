/**
 * The growth rule and the HTML collision rule of CONTRACT.md section 7, over every part of every
 * namespace. The TypeScript checker is the oracle. A part's own props are read against baselines
 * that Fuse does not define, React's element props and Base UI's `useRender` props, so a prop that
 * a Fuse base type adds or an inherited prop that a part redeclares counts as its own. The two part
 * lists below are the reviewed inventory, and a new part must join one of them or the coverage case
 * fails. Each detector has a negative control that a planted violation turns red.
 */
import type { ComponentProps, CSSProperties, HTMLAttributes, JSX, ReactElement } from "react";

import type { useRender } from "@base-ui/react/use-render";
import { expectTypeOf, test } from "vitest";

import type { Chart, PieChart, RadarChart, RadialChart } from "@elmeragroup/fuse/chart";
import type {
  ChartDomProps,
  ChartFigureProps,
  ChartLayerProps,
  ChartRootProps,
  ChartTooltipLabelProps,
  PieChartRootProps,
  RadarChartRootProps,
  RadialChartRootProps,
  SparklineProps,
} from "@elmeragroup/fuse/chart";

/** Every key of a props type, across the arms of a union. */
type AllKeys<P> = P extends unknown ? keyof P : never;

/** The type of a key across the arms of a union that declare it. */
type ValueAt<P, K extends PropertyKey> = P extends unknown ? (K extends keyof P ? P[K] : never) : never;

/** Whether two types are the same, by the identity check `expectTypeOf` uses. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** The keys a closed part may take besides its own, written here and not read from Fuse. */
type ClosedBase = "className" | "style";

/** The closed parts' baseline, the two React props a closed part takes, written here. */
type ClosedBaseline = { className?: string; style?: CSSProperties };

/**
 * Keys a part redeclares from a baseline with a different type, which hide among the inherited
 * keys. `style` takes Fuse's `ChartStyle` on purpose.
 */
type Overrides<P, Baseline> = {
  [K in Extract<AllKeys<P>, keyof Baseline>]-?: Same<ValueAt<P, K>, Baseline[K]> extends true ? never : K;
}[Extract<AllKeys<P>, keyof Baseline>];

/** A part's own keys, past a baseline, plus every baseline key it redeclares. */
type OwnKeys<P, Baseline> = Exclude<AllKeys<P>, keyof Baseline> | Exclude<Overrides<P, Baseline>, "style">;

/**
 * The own keys whose value is a boolean or holds both booleans. `children` is exempt, because
 * React's `ReactNode` holds `boolean` so that `{flag && <Part />}` renders nothing.
 */
type BooleanKeys<P, Own extends PropertyKey> = {
  [K in Exclude<Own, "children">]-?: [Exclude<ValueAt<P, K>, undefined>] extends [never]
    ? never
    : Exclude<ValueAt<P, K>, undefined> extends boolean
      ? K
      : boolean extends ValueAt<P, K>
        ? K
        : never;
}[Exclude<Own, "children">];

/** The own keys whose value can be a function. */
type FunctionKeys<P, Own extends PropertyKey> = {
  [K in Own]-?: [Extract<ValueAt<P, K>, (...args: never[]) => void>] extends [never] ? never : K;
}[Own];

/** The props of a part. */
type PropsOf<C> = C extends (props: infer P) => ReactElement ? P : never;

/** The four namespaces, keyed by their public names. */
type Namespaces = {
  Chart: typeof Chart;
  PieChart: typeof PieChart;
  RadialChart: typeof RadialChart;
  RadarChart: typeof RadarChart;
};

/** The shared closed parts, written here and checked against every namespace's keys. */
type SharedClosed = "Tooltip" | "LegendToggleGroup" | "LegendToggle" | "Table" | "TableColumn" | "Background";

/** The pie and radial closed parts that `PieChart` owns and `RadialChart` shares. */
type PolarClosed = "Track" | "Center" | "CenterValue" | "CenterShare" | "CenterMax" | "CenterLabel" | "Glow";

/** Each namespace's closed parts by member name, whose own keys are every key past `className` and `style`. */
type ClosedNames = {
  Chart:
    | SharedClosed
    | "Panel"
    | "Grid"
    | "XAxis"
    | "YAxis"
    | "Bar"
    | "BarGroup"
    | "Line"
    | "Area"
    | "Dots"
    | "ActiveDot"
    | "Marker"
    | "ValueLabel"
    | "Crosshair"
    | "ReferenceLine"
    | "ReferenceArea"
    | "ActiveValue"
    | "ActiveValueLine"
    | "Glow"
    | "Reveal"
    | "Brush"
    | "BrushPreview";
  PieChart: SharedClosed | PolarClosed | "Pie" | "Labels";
  RadialChart: SharedClosed | PolarClosed | "Bar";
  RadarChart:
    | SharedClosed
    | "Grid"
    | "AngleAxis"
    | "RadiusAxis"
    | "Area"
    | "Line"
    | "Dots"
    | "ActiveDot"
    | "Glow";
};

/** The element whose props each DOM part takes, by member name, written here. */
type DomElements = {
  Headline: "div";
  Takeaway: "p";
  Empty: "div";
  Legend: "ul";
  LegendItem: "li";
  LegendValue: "span";
  LegendShare: "span";
  TooltipLabel: "span";
  TooltipItems: "div";
  TooltipValue: "span";
  TooltipShare: "span";
  TooltipTotal: "div";
  Swatch: "span";
  SeriesLabel: "span";
  SeriesIcon: "span";
  Skeleton: "div";
};

/** The shared DOM parts. */
type SharedDom = Exclude<keyof DomElements, "TooltipTotal" | "Skeleton">;

/** Each namespace's DOM parts by member name. */
type DomNames = {
  Chart: SharedDom | "TooltipTotal" | "Skeleton";
  PieChart: SharedDom | "Skeleton";
  RadialChart: SharedDom | "Skeleton";
  RadarChart: SharedDom | "Skeleton";
};

/** Every member name the lists place, Root included. */
type Listed<N extends keyof Namespaces> = ClosedNames[N] | DomNames[N] | "Root";

/** A member's props, by namespace and member name. */
type MemberProps<N extends keyof Namespaces, K extends PropertyKey> = K extends keyof Namespaces[N]
  ? PropsOf<Namespaces[N][K]>
  : never;

/** The ARIA names and React props a part may consume on purpose. */
type AllowedHtml = "className" | "style" | "children" | "id" | "aria-label" | "aria-labelledby";

/** The own keys that collide with an HTML attribute name. */
type Collisions<P, Baseline> = Exclude<
  Extract<OwnKeys<P, Baseline>, keyof HTMLAttributes<HTMLElement>>,
  AllowedHtml
>;

type DomBaseline<E extends keyof JSX.IntrinsicElements> = useRender.ComponentProps<E>;

/** A per-member detector run over each namespace's closed members. */
type ClosedReport<Detect extends "booleans" | "functions" | "handlers"> = {
  [N in keyof Namespaces]: {
    [K in ClosedNames[N]]: Detect extends "booleans"
      ? BooleanKeys<MemberProps<N, K>, OwnKeys<MemberProps<N, K>, ClosedBaseline>>
      : Detect extends "functions"
        ? FunctionKeys<MemberProps<N, K>, OwnKeys<MemberProps<N, K>, ClosedBaseline>>
        : Extract<AllKeys<MemberProps<N, K>>, "render" | `on${string}`>;
  };
};

/** A per-member detector run over each namespace's DOM members. */
type DomReport<Detect extends "booleans" | "functions" | "collisions" | "contentOrColor"> = {
  [N in keyof Namespaces]: {
    [K in DomNames[N]]: K extends keyof DomElements
      ? Detect extends "booleans"
        ? BooleanKeys<MemberProps<N, K>, OwnKeys<MemberProps<N, K>, DomBaseline<DomElements[K]>>>
        : Detect extends "functions"
          ? FunctionKeys<MemberProps<N, K>, OwnKeys<MemberProps<N, K>, DomBaseline<DomElements[K]>>>
          : Detect extends "collisions"
            ? Collisions<MemberProps<N, K>, DomBaseline<DomElements[K]>>
            : Extract<AllKeys<MemberProps<N, K>>, "content" | "color">
      : never;
  };
};

/** The report every clean namespace gives, `never` for each listed member. */
type Clean<Names extends { [N in keyof Namespaces]: PropertyKey }> = {
  [N in keyof Namespaces]: { [K in Names[N]]: never };
};

type Roots = [ChartRootProps, PieChartRootProps, RadialChartRootProps, RadarChartRootProps];
type RootOwn<P> = OwnKeys<P, ComponentProps<"figure">>;

test("every namespace's member names are exactly the reviewed lists", () => {
  expectTypeOf<keyof typeof Chart>().toEqualTypeOf<Listed<"Chart">>();
  expectTypeOf<keyof typeof PieChart>().toEqualTypeOf<Listed<"PieChart">>();
  expectTypeOf<keyof typeof RadialChart>().toEqualTypeOf<Listed<"RadialChart">>();
  expectTypeOf<keyof typeof RadarChart>().toEqualTypeOf<Listed<"RadarChart">>();
});

test("Fuse's base types add no prop to the React and Base UI baselines", () => {
  expectTypeOf<keyof ChartLayerProps>().toEqualTypeOf<ClosedBase>();
  expectTypeOf<Exclude<keyof ChartDomProps<"div">, keyof DomBaseline<"div">>>().toEqualTypeOf<never>();
  expectTypeOf<Exclude<keyof ChartFigureProps, keyof ComponentProps<"figure">>>().toEqualTypeOf<never>();
  expectTypeOf<
    Extract<keyof ChartDomProps<"span">, "content" | "color" | "hidden">
  >().toEqualTypeOf<"hidden">();
  expectTypeOf<Extract<keyof ChartFigureProps, "content" | "color" | "hidden">>().toEqualTypeOf<never>();
});

test("no own prop below Root is a boolean or a function", () => {
  expectTypeOf<ClosedReport<"booleans">>().toEqualTypeOf<Clean<ClosedNames>>();
  expectTypeOf<ClosedReport<"functions">>().toEqualTypeOf<Clean<ClosedNames>>();
  expectTypeOf<DomReport<"booleans">>().toEqualTypeOf<Clean<DomNames>>();
  expectTypeOf<DomReport<"functions">>().toEqualTypeOf<Clean<DomNames>>();
  type SparklineOwn = OwnKeys<SparklineProps, ClosedBaseline>;
  expectTypeOf<BooleanKeys<SparklineProps, SparklineOwn>>().toEqualTypeOf<never>();
  expectTypeOf<FunctionKeys<SparklineProps, SparklineOwn>>().toEqualTypeOf<never>();
});

test("closed parts take no DOM handler and no render", () => {
  expectTypeOf<ClosedReport<"handlers">>().toEqualTypeOf<Clean<ClosedNames>>();
});

test("the only functions on Roots are the gesture callbacks", () => {
  expectTypeOf<FunctionKeys<Roots[0], RootOwn<Roots[0]>>>().toEqualTypeOf<
    "onSelectedKeyChange" | "onXRangeChange" | "onXRangeCommitted"
  >();
  expectTypeOf<FunctionKeys<Roots[1], RootOwn<Roots[1]>>>().toEqualTypeOf<"onSelectedKeyChange">();
  expectTypeOf<FunctionKeys<Roots[2], RootOwn<Roots[2]>>>().toEqualTypeOf<"onSelectedKeyChange">();
  expectTypeOf<FunctionKeys<Roots[3], RootOwn<Roots[3]>>>().toEqualTypeOf<"onSelectedKeyChange">();
});

test("no DOM part own prop shares a name with an HTML attribute, and content and color are gone", () => {
  expectTypeOf<DomReport<"collisions">>().toEqualTypeOf<Clean<DomNames>>();
  type RootCollisions = { [K in 0 | 1 | 2 | 3]: Collisions<Roots[K], ComponentProps<"figure">> };
  expectTypeOf<RootCollisions>().toEqualTypeOf<{ 0: never; 1: never; 2: never; 3: never }>();
  expectTypeOf<DomReport<"contentOrColor">>().toEqualTypeOf<Clean<DomNames>>();
  type RootHtmlLeaks = { [K in 0 | 1 | 2 | 3]: Extract<AllKeys<Roots[K]>, "hidden" | "content" | "color"> };
  expectTypeOf<RootHtmlLeaks>().toEqualTypeOf<{ 0: never; 1: never; 2: never; 3: never }>();
});

test("each detector turns red on a planted violation", () => {
  // A member planted on a namespace under a name no list holds fails the inventory by its name,
  // whatever its shape, and its planted props fail the prop detectors.
  type Sneaky = (props: ChartLayerProps & { animated?: boolean; onPick?: () => void }) => ReactElement;
  type PlantedChart = typeof Chart & { Sneaky: Sneaky };
  expectTypeOf<Exclude<keyof PlantedChart, Listed<"Chart">>>().toEqualTypeOf<"Sneaky">();
  type SneakyOwn = OwnKeys<PropsOf<Sneaky>, ClosedBaseline>;
  expectTypeOf<BooleanKeys<PropsOf<Sneaky>, SneakyOwn>>().toEqualTypeOf<"animated">();
  expectTypeOf<FunctionKeys<PropsOf<Sneaky>, SneakyOwn>>().toEqualTypeOf<"onPick">();
  // A boolean planted in the closed base counts as a new base key and as an own boolean.
  type AnimatedLayer = ChartLayerProps & { animated?: boolean };
  expectTypeOf<Exclude<keyof AnimatedLayer, ClosedBase>>().toEqualTypeOf<"animated">();
  expectTypeOf<
    BooleanKeys<AnimatedLayer, OwnKeys<AnimatedLayer, ClosedBaseline>>
  >().toEqualTypeOf<"animated">();
  // A handler planted on a closed part is an own function.
  type ClickLayer = ChartLayerProps & { onPick?: (key: string) => void };
  expectTypeOf<FunctionKeys<ClickLayer, OwnKeys<ClickLayer, ClosedBaseline>>>().toEqualTypeOf<"onPick">();
  // A prop planted in the DOM base, or an inherited attribute redeclared, is caught.
  type GrownDom = ChartDomProps<"span"> & { tone?: string };
  expectTypeOf<Exclude<keyof GrownDom, keyof DomBaseline<"span">>>().toEqualTypeOf<"tone">();
  type TitleOverride = Omit<ChartTooltipLabelProps, "title"> & { title?: number };
  expectTypeOf<Collisions<TitleOverride, DomBaseline<"span">>>().toEqualTypeOf<"title">();
  type HiddenFlag = Omit<ChartTooltipLabelProps, "hidden"> & { hidden?: "yes" | "no" };
  expectTypeOf<Collisions<HiddenFlag, DomBaseline<"span">>>().toEqualTypeOf<"hidden">();
});
