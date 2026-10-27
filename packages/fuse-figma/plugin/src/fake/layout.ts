/**
 * Layout and sizing: the sizing modes a layer reads and takes, resizes and the constraints they
 * apply, an instance's held lengths, limits, absolute placement, rotation, the boxes a layer reads,
 * and the field bindings that resize a layer.
 *
 * It models these rules. The numbers run across the whole fake, and `fake-figma.ts` lists the
 * module that holds each:
 * 5. `resize` and `resizeWithoutConstraints` on an auto layout frame set both sizing modes to
 *    FIXED. `planLayoutSizing` in `fields.ts` writes the sizing again after a length for this
 *    reason, as the plugin has since 4734b75e on 2026-10-19. Binding `width` or `height` resizes
 *    the same way.
 * 9. `resize` moves and resizes each child as its constraints say: `MIN` keeps the child where
 *    it is, `SCALE` scales its position and size by the parent's ratio, and `STRETCH` keeps its
 *    distance to both edges, so its size grows by what the parent's grows. A child that changes
 *    size resizes its own children the same way. An auto layout frame places the children in its
 *    flow by its layout instead, which the fake leaves as they are, and constrains only its
 *    absolute children (rule 24). `MAX` and `CENTER` keep the anchors rules 47 and 59 name, so
 *    the child's `x` and `y` follow the new size. `resizeWithoutConstraints` leaves the children as they are. Figma's reference pages
 *    for `resize` and `resizeWithoutConstraints` say so, and the icon components rely on it to
 *    bring a glyph back with its component.
 * 12. `layoutSizingHorizontal` and `layoutSizingVertical` read as a projection of other fields,
 *    as the real kit's nodes did on 2026-10-22 (P0). A layer reads FILL on an axis where its auto
 *    layout parent gives it the room, by growing along the parent's direction (`layoutGrow` 1) or
 *    stretching across it (`layoutAlign` STRETCH). Otherwise an auto layout frame reads HUG where
 *    the sizing mode of that axis is AUTO, the primary mode along its direction and the counter
 *    mode across it. A text reads HUG across while its `textAutoResize` is WIDTH_AND_HEIGHT, and
 *    down while it is that or HEIGHT. Every other axis reads FIXED. Writing FILL sets the grow or
 *    the stretch, as a real file showed (P1), and fixes the layer's own mode on that axis. Writing
 *    HUG or FIXED clears the fill and sets the mode. The fake reads `layoutGrow` and `layoutAlign`
 *    but takes no write of them, so the plugin writes only the shorthand. Rule 19 covers the write
 *    on a text, and rule 42 the read of a hidden layer.
 * 13. A sizing write Figma cannot apply throws the message a real file threw on 2026-10-22 (P1).
 *    FILL on a frame that has no auto layout and sits in none threw `node must be an
 *    auto-layout frame or a child of an auto-layout frame`, and the fake throws it for HUG there
 *    too. HUG on a layer without auto layout inside one threw `HUG can only be set on auto-layout
 *    frames or text children of auto-layout frames`. FILL on a layer whose parent has no auto
 *    layout, such as a variant root in its set, threw `FILL can only be set on children of
 *    auto-layout frames`. Each starts with `in set_layoutSizingHorizontal: ` or the vertical
 *    member's name.
 * 14. `resize` and a `width` or `height` binding also turn a filling layer fixed. On 2026-10-22 a
 *    real file read a FILL child as FIXED after a resize, and as FIXED at the variable's value
 *    after its width bound a FLOAT variable (P2). As rule 5 sets both modes, the fake clears the
 *    fill on both axes.
 * 15. Writing `layoutMode` keeps both sizing modes, each in its role along or across the
 *    direction. On 2026-10-22 a row that hugged its width read as hugging its height once it
 *    became a column, and went from 40 to 14 tall (P6). The plugin therefore writes the
 *    direction first, and after a turn it writes the box's fixed lengths and sizing, and its
 *    layers' sizing, again. The fake does not lay out, so a turn keeps the box's size. A parent
 *    that turns keeps its layers' grow and stretch in the fake, so their fill moves to the other
 *    axis. No probe has shown what Figma does with them.
 * 16. `minWidth`, `maxWidth`, `minHeight` and `maxHeight` hold a positive number or null, on an
 *    auto layout frame or a child of one, text included, and each binds a FLOAT variable, as the
 *    typings say. On 2026-10-22 a real file kept `maxWidth` on a hugging frame and on a text,
 *    kept `minHeight` on a column root, and read a bound `maxWidth` as the variable's value (P7).
 *    The fake does not lay out, so it does not clamp a size to its limits.
 * 17. `counterAxisAlignItems` refuses STRETCH, which its type leaves out, and BASELINE outside a
 *    horizontal auto layout, as the typings say. No probe ran.
 * 18. `primaryAxisAlignItems` keeps SPACE_BETWEEN through an `itemSpacing` write or binding, as a
 *    real file did on 2026-10-22 (P5).
 * 24. `layoutPositioning` ABSOLUTE takes a child of an auto layout frame out of the frame's flow,
 *    as a real file showed on 2026-10-22 (P8). A new node reads AUTO. An absolute child keeps the
 *    `x`, `y`, size and constraints written on it, where a write to an auto child's place is a
 *    no-op. When its parent resizes, it moves and resizes as its constraints say (rule 9): on the
 *    real file a 170 × 6 child at the top left of a 200 × 6 row, `SCALE` across and `STRETCH`
 *    down, was 340 wide once the row was 400 wide and 12 tall once the row was 12 tall, and stayed
 *    at 0, 0. FILL on it throws `in set_layoutSizingHorizontal: FILL cannot be set on absolute
 *    positioned auto-layout children`, or the vertical member's name. It does not count toward a
 *    hugging parent's size: on the real file a hugging frame holding a text and a 300 × 50 absolute
 *    child hugged the text alone. The fake does not lay out, so it never counts one. The typings
 *    take ABSOLUTE only on a child of an auto layout frame, and no probe turned a filling layer
 *    absolute, so the fake throws for both.
 * 26. `rotation` turns a layer counterclockwise by its degrees and reads from -180 to 180, the
 *    typings' `atan2(-m10, m00)` of its transform, so a whole turn more reads the same. On
 *    2026-10-22 a layer at -90 read `relativeTransform` `[[0, -1], [1, 0]]`, a clockwise turn in
 *    Figma's y-down space, and a free frame turned about its top left, as the typings say (PQ).
 *    The fake turns a layer outside auto layout about its top left. In an auto layout flow, a
 *    real file kept a half-turned layer's box in its slot (PR): a 16px icon 34px into a hugging
 *    row read `x` 50 and `y` 16 at 180, the transform's origin at the box's far corner, while its
 *    `absoluteBoundingBox` and the row's size stayed, and read 34 and 0 again at 0. The fake moves
 *    such a layer's origin so its box keeps its center, and `absoluteBoundingBox` bounds the
 *    turned box. A quarter turn lays the layer out by its turned box: a 20 × 10 frame at -90 in a
 *    hugging row made the row 10 × 20 and read `x` 10 and `y` 0 (PQ). The fake does not lay out,
 *    so there it keeps the box's center and the row's size, as rule 24 keeps a hugging parent's
 *    size around an absolute child.
 * 29. A layer that fills across an auto layout that hugs that axis stretches to the length the
 *    layout's other layers set. On 2026-10-23 a hugging row held a fixed 40 × 40 frame and a 39 × 16
 *    hugging frame. FILL down the small frame read FILL and `layoutAlign` STRETCH, made it 40 tall
 *    with its text centred, and left the row hugging both ways. Resizing the square to 60 tall made
 *    the row and the filled frame 60 tall (PF). The fake reads such a layer's length as the longest
 *    of the other layers in the flow that do not fill the axis, so it follows them as they resize,
 *    and `absoluteBoundingBox` reads the same. No probe filled a layer whose siblings all fill, so
 *    there the layer keeps its own length.
 * 31. A fill across never widens a text that is 0 wide. On 2026-10-23 the owner's real file held
 *    every filling text of the kit at width 0, its characters one per line, and a probe replayed
 *    the plugin's order for a new text in a fixed 384px row: an empty text under HEIGHT was 0 wide,
 *    and FILL left it 0 wide after its characters arrived and after FILL was written again. Writing
 *    the characters first gave it 364. `resize(1, height)` on the 0-wide filling text kept FILL and
 *    reflowed it to 364 (PZ). The fake gives a text that hugs its characters a width when they are
 *    written, half its font size a character, since it measures no glyphs, and 0 for none. A fill
 *    keeps a text's width, so one that was 0 wide reads 0 across, and a positive resize of such a
 *    text keeps its fill. The fake does not lay out, so the text keeps the width written.
 * 32. An instance takes its main component's new size only when it is read. On 2026-10-23, after an
 *    Apply that repaired the owner's 0-wide texts, a new Plan still re-stacked the previews on seven
 *    pages, and a probe showed why: in the call that resized a component, the component and an
 *    instance that was read took the new height at once, while an instance nobody read kept its old
 *    size and its hugging auto layout parent sized from it (816 tall for three, 48 once each instance
 *    was read first). Waiting changed nothing, and a fresh call read every size settled (PI). The
 *    fake gives an instance its main component's size on a read of its width or height, and on every
 *    instance when a run starts. An instance resized or rescaled itself keeps its own length on each
 *    axis, until HUG on an axis lets that axis take its content's length again, as HUG gave a
 *    resized nested instance its hug width on 2026-10-23 (N4). A frame
 *    or component that wraps a horizontal auto layout and hugs its height, as a preview and its
 *    groups do, sizes from its children as they stand: rows of its width less its side padding,
 *    `itemSpacing` between children, `counterAxisSpacing` between rows, and its top and bottom
 *    padding. An instance of one takes the component's height. The same holds at every depth (N2):
 *    a component that hugged a nested instance of another set's variant, padded 16 a side, read 102
 *    wide, kept 102 after the variant grew, read 94 for the nested instance and then 126. So a frame
 *    or component that hugs an axis without wrapping and holds an instance of a set's variant sizes
 *    that axis from its children as they stand, their lengths and `itemSpacing` along its direction
 *    and the longest across, and its padding. A nested instance seen through an outer instance takes
 *    the size its main layer stands at. A new run settles a nested instance before the instances
 *    that show it. No other frame lays out.
 * 40. Binding the width or height of an instance that hugs that axis records the binding and keeps
 *    the hug length: on 2026-10-23 a nested instance whose height bound `row-h` kept its 26px hug
 *    height (N4). The plugin therefore writes FIXED before it binds an instance's length. A binding
 *    on any other axis resizes, as rule 5 says: on 2026-10-24 a frame that hugged its 28px height
 *    turned FIXED, in its layout sizing and its counter-axis mode, at `row-h`'s 32 (NS).
 * 42. A hidden child of an auto layout reads `layoutSizingHorizontal` or `layoutSizingVertical`
 *    FIXED on an axis it fills, and keeps the fill in `layoutGrow` 1 along its parent's direction or
 *    `layoutAlign` STRETCH across it. On 2026-10-24 a hidden frame in a fixed 300-wide column read
 *    FIXED and STRETCH after a FILL across, read FILL and 300 wide once shown, and FIXED and STRETCH
 *    hidden again, and a FILL written while shown read the same once hidden. Hidden in a fixed row, a
 *    FILL along read FIXED with `layoutGrow` 1 and FILL once shown, and in a hugging row a FILL down
 *    read FIXED with STRETCH and FILL once shown (NH). The owner's file read Alert's and Empty's hidden
 *    actions that way after an Apply. The fake hides a layer only through a BOOLEAN property (rule
 *    25), and reads a hidden layer that hugs as it reads a shown one, which no probe contradicted.
 * 47. An absolute instance at MAX across and CENTER down. On 2026-10-25 a hugging badge instance,
 *    ABSOLUTE in a 200px item that hugged a row bound to `row-h`, kept 4px from the item's end as its
 *    own TEXT widened it from 23 to 39 and as the item widened to 240, and kept its centre's offset
 *    from the item's centre as the item went 40, 36 and 32 tall through density switches. An outer
 *    instance of the item pinned Comfortable read its row 36 tall and the badge at the same offset. The
 *    badge listed `layoutPositioning` and `name` among its overrides, and `width` and `height` once its
 *    own size differed from its main's, never `x`, `y` or `constraints` (N11). So the fake keeps an
 *    anchored child's end inset and centre offset and reads `x` and `y` from them and the sizes as they
 *    stand. A sublayer an instance shows reads its source's anchor and constraints as they stand until
 *    its own are written, and places itself against its own parent, as the outer instance's badge
 *    followed the main's from 197 to 221. A bound length resolves in the modes of the layer that reads
 *    it, an instance's through its main, and an instance whose main hugs nested instances hugs its own
 *    by its main's layout as that stands, each settled from its source as that stands (rule 32).
 *    Writing ABSOLUTE on an instance lists `layoutPositioning`.
 * 56. An instance its modes give another size than its main holds its lengths. On 2026-10-26 a row
 *    404 wide, hugging a height its padding bound to `row-py`, read 404 × 32, and its instances in a
 *    frame pinned Comfortable read 404 × 36 and listed `height` and `width` among their overrides
 *    (G13). Once read, an instance kept 404 when the main went to 366, and the instances first read
 *    after that kept 366 when the main went to 300. Only a width write moved one: `resize(366,
 *    height)` and a HUG down gave 366 × 36, which then held. A width bound to a FLOAT variable, 100
 *    in the main's mode and 140 in the frame's, read 140 on the instance, bound and listed the same
 *    way, and followed a new value of the variable (G14). When the main unbound its width and went to
 *    90, the instance kept its last length unbound. A new binding on the main bound it again, as did
 *    `setBoundVariable("width", v)` on the instance itself (G15). The fake holds an instance's lengths
 *    at its first read where they differ from its main's, as rule 32 holds a resized one, and shows
 *    the binding its main holds on a width or height the instance binds none of its own, its length
 *    following the variable in the instance's modes. The fake does not lay out padding, so its tests
 *    make the height differ through a bound row the main hugs (rule 32). An instance in a frame whose
 *    modes match its main's read the main's width binding too, at the main's 100 × 32, and listed no
 *    overrides (G16). A held instance at 404 × 36, unbound, that `swapComponent` pointed at a variant
 *    366 wide read 366 × 36 and still listed `width` and `height`, and a fresh instance in a matching
 *    mode read 366 × 32 after the same swap, with no overrides (G17). So a swap gives an instance its
 *    modes hold the new component's size in those modes and keeps the lengths listed. An instance of a
 *    16 × 16 component resized to 12 × 12 read 12 × 12 after a swap to another 16 × 16 component, with
 *    `width` and `height` still listed, in a plain frame, in an auto layout row and inside a component
 *    (G18). So an instance resized itself keeps its lengths through a swap, as an icon resized to 12
 *    keeps them through a swap to a rebuilt icon library. One reading fits G17 and G18 together: a
 *    swap keeps a length that differs from the old main's and takes the new main's where it equals
 *    it, as G17's held 404 equalled the old variant's width and its 36 did not. No probe tells that
 *    reading apart from the fake's split by `heldByModes`. `resetOverrides()` left a held instance at
 *    366 × 36 against a main at 300, still listing `width` and `height` (G13), so the fake's
 *    `removeOverrides`, which the typings name its replacement, keeps a held instance's lengths
 *    listed. An instance's own `setBoundVariable("width", null)` on a main bound to 100 in mode A
 *    and 140 in mode B kept 100 in a matching mode and 140 in mode B, read unbound, and listed
 *    `boundVariables`, `height` and `width`. It kept those lengths when the variable's values went
 *    to 120 and 180, and followed them once bound again (G19). The fake has no `setValueForMode`, so
 *    it holds both lengths from the unbind on, as it holds a resized instance's, until a binding
 *    comes back. A HUG on such an instance in mode B gave 36 × 36 and listed `primaryAxisSizingMode`
 *    too (G19), which the fake does not model. The probes left open a FILL axis, a value change seen
 *    by an instance whose main is unbound, what `removeOverrides` does to an own unbind, which the
 *    fake reverts, and the order of the listed fields. A HUG write drops the length from the
 *    overrides as rule 32 says, where G13 still listed it.
 * 57. Turning auto layout on includes the strokes in the layout. On 2026-10-26, on scratch frames in
 *    the owner's file `Untitled` (PS3), a new frame or component read `strokesIncludedInLayout`
 *    false, and `layoutMode` from NONE to HORIZONTAL or VERTICAL set it true. PS4, on the same file
 *    that day, read a new frame false and NONE to GRID set it true. HORIZONTAL to VERTICAL, to GRID,
 *    to HORIZONTAL again and to NONE kept the value, so a frame turned back to NONE reads what it
 *    held. In auto layout a false written after true stuck, whatever stroke, weight, align,
 *    clipping, children or sizing writes came around it. The owner's Apply that created Item's image
 *    media read the new box's false, wrote no false, and its `layoutMode` write then turned the
 *    field true.
 * 58. `strokesIncludedInLayout` takes a write only in auto layout. On the same frames a write while
 *    `layoutMode` was NONE threw `in set_strokesIncludedInLayout: Can only set
 *    strokesIncludedInLayout on nodes with layoutMode !== NONE` (PS3).
 * 59. CENTER across and MAX down keep a place as rule 47's MAX across and CENTER down do: CENTER the
 *    offset of the layer's centre from its parent's, MAX the inset from its end to its parent's, each
 *    on its own axis, so `x` and `y` follow the parent's size. On 2026-10-27 a real file kept a 10px
 *    frame at -45, ABSOLUTE in a 120px popup at CENTER and MAX, centred at (W/2, H - 2): its
 *    `relativeTransform` read `[[0.7071, -0.7071, 60], [0.7071, 0.7071, 22.9297]]` whether `x` and `y`
 *    were written before the turn or after it, and it followed a density switch from 32 to 36 tall and
 *    text-driven widths of 101, 161 and 229, in the main and in an instance with no overrides (W5-P11,
 *    W5-P11b). Figma keeps a CENTER shift whole: an instance narrowed by an odd number of pixels put
 *    the centre 0.5px off (42 wide, 20.5). The fake keeps the exact half, since no kit cell resizes such
 *    an instance by an odd width.
 */

import { hiddenByProperty, markOverride, noteOverride } from "./overrides.ts";
import { bindingTargets, CORNERS, f32, isAutoLayout, isTextField, sourceOf, write } from "./state.ts";
import type {
  Axis,
  BindableField,
  Lengths,
  LimitField,
  NodeState,
  Sides,
  Sizing,
  Transform,
} from "./state.ts";
import { bindWholeText, requireHeldFonts } from "./text.ts";
import { childrenOf } from "./tree.ts";
import { fileVariable, requireType, resolveNumber, variableState } from "./variables.ts";

/**
 * Resize a node, turn an auto layout frame's sizing modes to FIXED (rule 5), and stop it filling
 * its auto layout parent (rule 14). A text whose height follows its lines keeps it (rule 19), and a
 * 0-wide one that fills across keeps the fill, which the width lets take over (rule 31).
 */
export function resize(state: NodeState, width: number, height: number): void {
  const followsLines = state.type === "TEXT" && state.textAutoResize === "HEIGHT";
  if (width < 0.01 || (!followsLines && height < 0.01)) {
    throw new Error(`Cannot resize ${state.id} to ${width} × ${height}: both must be at least 0.01.`);
  }
  const stuckFill = followsLines && state.width === 0 && fills(state, "HORIZONTAL");
  ownSize(state);
  state.width = f32(width);
  if (!followsLines) {
    state.height = f32(height);
  }
  if (isAutoLayout(state)) {
    state.primaryAxisSizingMode = "FIXED";
    state.counterAxisSizingMode = "FIXED";
  }
  if (stuckFill) {
    return;
  }
  state.layoutGrow = 0;
  state.layoutAlign = "INHERIT";
}

/**
 * The width the fake gives a text that hugs its characters. It measures no glyphs, so each
 * character takes half the font size, and an empty text is 0 wide, as a real one is (rule 31).
 */
export function measuredWidth(characters: string, fontSize: number): number {
  return f32(characters.length * fontSize * 0.5);
}

/** Where a child's start and size land on one axis when its parent grows from `before` to `after`. */
function constrainAxis(
  constraint: ConstraintType,
  start: number,
  size: number,
  before: number,
  after: number
): readonly [number, number] {
  switch (constraint) {
    case "MIN":
      return [start, size];
    case "SCALE":
      return [(start * after) / before, (size * after) / before];
    case "STRETCH":
      return [start, size + after - before];
    // The layer's anchors keep its place (rule 47), so `x` and `y` read it from the new length.
    case "MAX":
    case "CENTER":
      return [start, size];
  }
}

/**
 * Resize a node and move and resize each child as its constraints say (rule 9). An auto layout
 * frame places its children in its flow by its layout instead, which the fake does not model, and
 * moves and resizes only its absolute children by their constraints (rule 24).
 */
export function resizeWithConstraints(state: NodeState, width: number, height: number): void {
  const before = { width: state.width, height: state.height };
  resize(state, width, height);
  const constrained = isAutoLayout(state)
    ? childrenOf(state).filter((child) => child.layoutPositioning === "ABSOLUTE")
    : childrenOf(state);
  for (const child of constrained) {
    const [x, childWidth] = constrainAxis(
      child.constraints.horizontal,
      child.x,
      child.width,
      before.width,
      state.width
    );
    const [y, childHeight] = constrainAxis(
      child.constraints.vertical,
      child.y,
      child.height,
      before.height,
      state.height
    );
    child.x = f32(x);
    child.y = f32(y);
    if (f32(childWidth) !== child.width || f32(childHeight) !== child.height) {
      resizeWithConstraints(child, childWidth, childHeight);
    }
  }
}

/**
 * A layer's constraints: its own once written, else, for a sublayer an instance shows, its source's as
 * that stands (rule 47), since an outer instance's badge kept no constraints of its own (N11).
 */
export function constraintsOf(state: NodeState): Constraints {
  return state.mirrorOf === undefined || state.overridden.has("constraints")
    ? state.constraints
    : constraintsOf(state.mirrorOf);
}

/**
 * The anchor a layer's constraint on an axis keeps (rules 47, 59): its end inset under MAX, its
 * centre's offset under CENTER, or none under any other.
 */
function anchoredOn(state: NodeState, axis: Axis): "end" | "centre" | undefined {
  const constraint = axis === "HORIZONTAL" ? constraintsOf(state).horizontal : constraintsOf(state).vertical;
  return constraint === "MAX" ? "end" : constraint === "CENTER" ? "centre" : undefined;
}

/**
 * A layer's anchor on an axis: its own once its place is written, else, for a sublayer an instance
 * shows, its source's as that stands. An outer instance's badge followed the main's badge from 197 to
 * 221 with no override (N11).
 */
function anchorOf(state: NodeState, axis: Axis): number | undefined {
  const written = state.overridden.has(axis === "HORIZONTAL" ? "x" : "y");
  if (state.mirrorOf !== undefined && !written) {
    return anchorOf(state.mirrorOf, axis);
  }
  return axis === "HORIZONTAL" ? state.anchors.horizontal : state.anchors.vertical;
}

/** A layer's length and its parent's on an axis, each as a read gives it (rules 32, 47). */
function lengthsOn(state: NodeState, parent: NodeState, axis: Axis): Lengths {
  return { own: lengthOn(settled(state), axis), outer: lengthOn(settled(parent), axis) };
}

/**
 * Where an anchored layer sits on an axis (rules 47, 59): under MAX its parent's length less its end
 * inset and its own length, under CENTER its parent's centre moved by its centre offset. The place is
 * the layer's `x` or `y`, the origin of a turned layer's transform, which moves with the parent's
 * length as the unturned box's would.
 *
 * @returns The `x` or `y`, or undefined for a layer that keeps the one written.
 */
export function anchoredPlace(state: NodeState, axis: Axis): number | undefined {
  const anchor = anchorOf(state, axis);
  const parent = state.parent;
  const kind = anchoredOn(state, axis);
  if (anchor === undefined || parent === undefined || kind === undefined) {
    return undefined;
  }
  const { own, outer } = lengthsOn(state, parent, axis);
  return f32(kind === "end" ? outer - anchor - own : outer / 2 + anchor - own / 2);
}

/** Write a layer's place on an axis: an anchor where its constraint keeps one (rules 47, 59), else `x` or `y`. */
export function place(state: NodeState, axis: Axis, value: number): void {
  const parent = state.parent;
  const kind = parent === undefined ? undefined : anchoredOn(state, axis);
  const lengths = parent === undefined || kind === undefined ? undefined : lengthsOn(state, parent, axis);
  const anchor =
    lengths === undefined
      ? undefined
      : kind === "end"
        ? lengths.outer - value - lengths.own
        : value + lengths.own / 2 - lengths.outer / 2;
  if (axis === "HORIZONTAL") {
    state.anchors.horizontal = anchor;
    state.x = value;
  } else {
    state.anchors.vertical = anchor;
    state.y = value;
  }
}

/**
 * Note that an instance holds a width and a height of its own, which its main component's resize
 * leaves (rule 32), until a HUG on an axis lets that axis follow its content again.
 */
export function ownSize(state: NodeState): void {
  if (state.type === "INSTANCE") {
    state.overridden.add("width");
    state.overridden.add("height");
    state.heldByModes = false;
  }
}

/** The override that holds an instance's own length on an axis (rule 32). */
function lengthOverride(axis: Axis): "width" | "height" {
  return axis === "HORIZONTAL" ? "width" : "height";
}

export function rescale(state: NodeState, scale: number): void {
  ownSize(state);
  state.x = f32(state.x * scale);
  state.y = f32(state.y * scale);
  state.width = f32(state.width * scale);
  state.height = f32(state.height * scale);
  for (const child of state.children) {
    rescale(child, scale);
  }
}

/** The sizing mode of an auto layout frame that covers an axis: the primary one along its direction. */
function modeOn(state: NodeState, axis: Axis): "primaryAxisSizingMode" | "counterAxisSizingMode" {
  return state.layoutMode === axis ? "primaryAxisSizingMode" : "counterAxisSizingMode";
}

/** Whether a node sets its own place: it sits outside any auto layout's flow, or absolute in one (rule 24). */
export function placesItself(state: NodeState): boolean {
  return !isAutoLayout(state.parent) || state.layoutPositioning === "ABSOLUTE";
}

/** Whether a node fills an axis of its auto layout parent: it grows along its direction, or stretches across it. */
export function fills(state: NodeState, axis: Axis): boolean {
  const parent = state.parent;
  if (parent === undefined || !isAutoLayout(parent)) {
    return false;
  }
  return parent.layoutMode === axis ? state.layoutGrow === 1 : state.layoutAlign === "STRETCH";
}

/**
 * Give an instance the size of what it shows, as a read of it does (rule 32): its main component's,
 * or for a nested instance seen through an outer instance, its main layer's as that stands. An
 * instance resized or rescaled itself keeps its own length on each axis it does not hug again, and
 * any other node reads as it stands. A length its main binds follows the variable in the instance's
 * modes, a held one included (rule 56).
 *
 * @returns The node.
 */
export function settled(state: NodeState): NodeState {
  const source = sourceOf(state);
  if (state.type !== "INSTANCE" || source === undefined) {
    return state;
  }
  const held = (axis: Axis): boolean => state.overridden.has(lengthOverride(axis));
  const free = !held("HORIZONTAL") && !held("VERTICAL");
  for (const axis of ["HORIZONTAL", "VERTICAL"] as const) {
    const bound = state.unboundLengths.has(lengthOverride(axis))
      ? undefined
      : boundThrough(source, state, axis);
    if (bound !== undefined || !held(axis)) {
      const length = bound ?? ownHug(state, source, axis) ?? lengthOn(source, axis);
      if (axis === "HORIZONTAL") {
        state.width = length;
      } else {
        state.height = length;
      }
    }
  }
  // An instance its modes give another size than its main holds its lengths from then on (rule 56).
  if (
    free &&
    state.mirrorOf === undefined &&
    (state.width !== lengthOn(source, "HORIZONTAL") || state.height !== lengthOn(source, "VERTICAL"))
  ) {
    ownSize(state);
    state.heldByModes = true;
  }
  return state;
}

/**
 * The length an instance binds through its main, or its main's main, in the instance's own modes
 * (rule 47), up to the first source that holds a length of its own.
 */
function boundThrough(source: NodeState, consumer: NodeState, axis: Axis): number | undefined {
  for (let node: NodeState | undefined = source; node !== undefined; node = sourceOf(node)) {
    const length = boundLength(node, consumer, axis);
    if (length !== undefined || node.overridden.has(lengthOverride(axis))) {
      return length;
    }
  }
  return undefined;
}

/**
 * The length an instance hugs around its own nested instances, each settled first, where its main
 * hugs them (rules 32, 47): an Item instance pinned Comfortable hugged its row at 36 (N11). A nested
 * instance settles from its source as that stands, so the instance stays stale until its sources are
 * read (N2). The layout is its main's as that stands, a padding added later included, and the
 * children and the modes they read are the instance's own.
 */
function ownHug(state: NodeState, source: NodeState, axis: Axis): number | undefined {
  if (!hugsInstances(source, axis)) {
    return undefined;
  }
  for (const child of childrenOf(state)) {
    if (child.type === "INSTANCE") {
      settled(child);
    }
  }
  return huggedLength(state, axis, layoutOwner(source));
}

/** The node a layer takes its layout from: the end of its chain of sources, its main's own layer. */
function layoutOwner(state: NodeState): NodeState {
  let owner = state;
  for (let next = sourceOf(owner); next !== undefined; next = sourceOf(owner)) {
    owner = next;
  }
  return owner;
}

/**
 * A length a layer binds, in the modes a consumer reads (rules 8, 47): an instance reads its main's
 * binding in its own modes, as an item pinned Comfortable read its row's `row-h` as 36 (N11). A
 * binding that leaves a hugging instance at its hug size (rule 40) gives none.
 *
 * @returns The length, or undefined where the axis binds none.
 */
function boundLength(state: NodeState, consumer: NodeState, axis: Axis): number | undefined {
  const field = axis === "HORIZONTAL" ? "width" : "height";
  const bound = state.bindings.get(field);
  return bound === undefined || keepsHug(state, field)
    ? undefined
    : f32(resolveNumber(state.file, variableState(state.file, bound), consumer));
}

/**
 * Whether a frame or component sizes an axis from its children as they stand (rule 32): it hugs that
 * axis without wrapping and holds an instance of a set's variant in its flow, as a component that
 * nests another set's variant did on a real file (N2). The fake lays out no other frame.
 */
function hugsInstances(state: NodeState, axis: Axis): boolean {
  return (
    (state.type === "FRAME" || state.type === "COMPONENT") &&
    state.mirrorOf === undefined &&
    isAutoLayout(state) &&
    state.layoutWrap !== "WRAP" &&
    state[modeOn(state, axis)] === "AUTO" &&
    childrenOf(state).some(
      (child) =>
        child.type === "INSTANCE" &&
        child.layoutPositioning !== "ABSOLUTE" &&
        child.main?.parent?.type === "COMPONENT_SET"
    )
  );
}

/**
 * The length of an axis a frame hugs around its children as they stand (rule 32): along its
 * direction their lengths, `itemSpacing` between them and its padding, and across it the longest
 * child that does not fill that axis and its padding. A layer a BOOLEAN property hides leaves the
 * layout, as it did on a real file (PB), and so does an absolute one (rule 24). An instance lays out
 * its own children by its main's layout as that stands, so `layout` names the node whose direction,
 * padding, spacing and stroke apply (rule 47).
 */
function huggedLength(state: NodeState, axis: Axis, layout: NodeState = state): number {
  const flow = childrenOf(state).filter(
    (child) => child.layoutPositioning !== "ABSOLUTE" && !hiddenByProperty(child)
  );
  const padding =
    axis === "HORIZONTAL"
      ? inset(layout, "left") + inset(layout, "right")
      : inset(layout, "top") + inset(layout, "bottom");
  if (layout.layoutMode === axis) {
    const lengths = flow.reduce((sum, child) => sum + lengthOn(child, axis), 0);
    return padding + lengths + layout.itemSpacing * Math.max(0, flow.length - 1);
  }
  const across = flow.filter((child) => !fills(child, axis)).map((child) => lengthOn(child, axis));
  return padding + Math.max(0, ...across);
}

/**
 * The height of a horizontal auto layout that wraps and hugs its height (rule 32): its children in
 * flow, as they stand, packed into rows of its width less its side padding with `itemSpacing`
 * between them, each row as tall as its tallest child, `counterAxisSpacing` between the rows, and
 * its top and bottom padding.
 */
function wrapHeight(state: NodeState): number {
  const room = state.width - inset(state, "left") - inset(state, "right");
  const rows: number[] = [];
  let rowWidth = 0;
  let rowHeight = 0;
  let count = 0;
  for (const child of childrenOf(state)) {
    if (child.layoutPositioning === "ABSOLUTE") {
      continue;
    }
    const width = lengthOn(child, "HORIZONTAL");
    const height = lengthOn(child, "VERTICAL");
    if (count > 0 && rowWidth + state.itemSpacing + width > room) {
      rows.push(rowHeight);
      rowWidth = 0;
      rowHeight = 0;
      count = 0;
    }
    rowWidth += (count > 0 ? state.itemSpacing : 0) + width;
    rowHeight = Math.max(rowHeight, height);
    count += 1;
  }
  if (count > 0) {
    rows.push(rowHeight);
  }
  const between = Math.max(0, rows.length - 1) * (state.counterAxisSpacing ?? 0);
  return inset(state, "top") + rows.reduce((sum, row) => sum + row, 0) + between + inset(state, "bottom");
}

/**
 * What an auto layout keeps clear inside one edge: its padding, and the weight of a stroke it holds on
 * that side while `strokesIncludedInLayout` is true (rule 46, PS). A frame without a stroke keeps its
 * padding alone: in PS4 a stroke-less hugging row with the field true, padding 0, around a fixed
 * 20 × 20 child measured 20 × 20 at weight 1 and at weight 4, and the same row with a SOLID INSIDE
 * stroke of weight 4 measured 28 × 28.
 */
function inset(state: NodeState, side: keyof Sides): number {
  const stroked = state.strokesIncludedInLayout && state.strokes.length > 0;
  return state.padding[side] + (stroked ? state.strokeWeights[side] : 0);
}

/**
 * A node's length on an axis: the height a wrapping row that hugs it sizes to from its children
 * (rule 32), the length it stretches to across an auto layout that hugs that axis (rule 29), the
 * longest of the parent's other layers in its flow that do not fill the axis, or its own where it
 * does not stretch so or no such layer sets a length. Its own is the length it hugs around a nested
 * instance as its children stand (rule 32), or the one it was given.
 */
export function lengthOn(state: NodeState, axis: Axis): number {
  // An instance holds its main component's size, or its own (rule 32), so only a frame lays out.
  if (
    axis === "VERTICAL" &&
    state.type !== "INSTANCE" &&
    state.layoutMode === "HORIZONTAL" &&
    state.layoutWrap === "WRAP" &&
    state.counterAxisSizingMode === "AUTO"
  ) {
    return wrapHeight(state);
  }
  const given = boundLength(state, state, axis) ?? (axis === "HORIZONTAL" ? state.width : state.height);
  const own = hugsInstances(state, axis) ? huggedLength(state, axis) : given;
  const parent = state.parent;
  // A fill never widens a 0-wide text (rule 31).
  const stuck = state.type === "TEXT" && axis === "HORIZONTAL" && own === 0;
  if (
    stuck ||
    parent === undefined ||
    !isAutoLayout(parent) ||
    parent.layoutMode === axis ||
    parent[modeOn(parent, axis)] !== "AUTO" ||
    !fills(state, axis)
  ) {
    return own;
  }
  const lengths = parent.children
    .filter((child) => child !== state && child.layoutPositioning !== "ABSOLUTE" && !fills(child, axis))
    .map((child) => lengthOn(child, axis));
  return lengths.length === 0 ? own : Math.max(...lengths);
}

/**
 * What `layoutSizingHorizontal` or `layoutSizingVertical` reads (rule 12): FILL where the parent's
 * auto layout gives the node its room, HUG where the node's own sizing mode or text auto resize
 * follows its content, and FIXED otherwise.
 */
export function sizingOn(state: NodeState, axis: Axis): Sizing {
  if (fills(state, axis)) {
    // A hidden layer keeps the fill in its grow or stretch and reads FIXED (rule 42).
    return hiddenByProperty(state) ? "FIXED" : "FILL";
  }
  if (state.type === "TEXT") {
    return textHugs(state, axis) ? "HUG" : "FIXED";
  }
  return isAutoLayout(state) && state[modeOn(state, axis)] === "AUTO" ? "HUG" : "FIXED";
}

/** Whether a text's auto resize follows its characters on an axis: across only for WIDTH_AND_HEIGHT. */
function textHugs(state: NodeState, axis: Axis): boolean {
  return (
    state.textAutoResize === "WIDTH_AND_HEIGHT" || (axis === "VERTICAL" && state.textAutoResize === "HEIGHT")
  );
}

/** Stop filling an axis of the parent, as a hug or fixed size does. */
function stopFilling(state: NodeState, axis: Axis): void {
  if (state.parent?.layoutMode === axis) {
    state.layoutGrow = 0;
  } else {
    state.layoutAlign = "INHERIT";
  }
}

/**
 * Write `layoutSizingHorizontal` or `layoutSizingVertical` through the fields the shorthand covers
 * (rule 12), with the errors a real file threw for a sizing it cannot apply (rule 13).
 */
export function setSizing(state: NodeState, axis: Axis, value: Sizing): void {
  const member = `set_layoutSizing${axis === "HORIZONTAL" ? "Horizontal" : "Vertical"}`;
  const ownLayout = isAutoLayout(state);
  const inLayout = isAutoLayout(state.parent);
  if (value !== "FIXED" && !ownLayout && !inLayout) {
    throw new Error(`in ${member}: node must be an auto-layout frame or a child of an auto-layout frame`);
  }
  if (value === "HUG" && !ownLayout && state.type !== "TEXT") {
    throw new Error(
      `in ${member}: HUG can only be set on auto-layout frames or text children of auto-layout frames`
    );
  }
  if (value === "FILL" && !inLayout) {
    throw new Error(`in ${member}: FILL can only be set on children of auto-layout frames`);
  }
  if (value === "FILL" && state.layoutPositioning === "ABSOLUTE") {
    throw new Error(`in ${member}: FILL cannot be set on absolute positioned auto-layout children`);
  }
  if (state.type === "TEXT") {
    setTextSizing(state, axis, value, member.slice(4));
    return;
  }
  write(state, member.slice(4));
  if (value === "FILL") {
    if (state.parent?.layoutMode === axis) {
      state.layoutGrow = 1;
    } else {
      state.layoutAlign = "STRETCH";
    }
  } else if (inLayout) {
    stopFilling(state, axis);
  }
  // An instance that hugs an axis again takes its content's length there (rule 32, N4).
  if (value === "HUG") {
    state.overridden.delete(lengthOverride(axis));
  }
  if (ownLayout) {
    state[modeOn(state, axis)] = value === "HUG" ? "AUTO" : "FIXED";
  }
}

/**
 * Write a text's `layoutSizingHorizontal` or `layoutSizingVertical` (rule 19). A fill across a
 * text that hugs its characters fixes its width and lets its height follow its lines, as a real
 * file showed (P3). A hug or fixed size stops a fill, and the fake takes it only where the text's
 * auto resize already reads it, since no probe showed how such a write moves the auto resize.
 */
function setTextSizing(state: NodeState, axis: Axis, value: Sizing, member: string): void {
  requireHeldFonts(state, member);
  if (value === "FILL") {
    if (axis === "VERTICAL") {
      throw new Error(`The fake Figma file does not model ${member} FILL on a text.`);
    }
    write(state, member);
    if (state.parent?.layoutMode === axis) {
      state.layoutGrow = 1;
    } else {
      state.layoutAlign = "STRETCH";
    }
    if (state.textAutoResize === "WIDTH_AND_HEIGHT") {
      state.textAutoResize = "HEIGHT";
    }
    return;
  }
  if ((value === "HUG") !== textHugs(state, axis)) {
    throw new Error(
      `The fake Figma file does not model ${member} ${value} on a text whose auto resize is ${state.textAutoResize}.`
    );
  }
  write(state, member);
  if (isAutoLayout(state.parent)) {
    stopFilling(state, axis);
  }
}

/** Write `layoutMode`: turning auto layout on includes the strokes in it (rule 57). */
export function setLayoutMode(state: NodeState, value: FrameNode["layoutMode"]): void {
  write(state, "layoutMode");
  if (state.layoutMode === "NONE" && value !== "NONE") {
    state.strokesIncludedInLayout = true;
  }
  state.layoutMode = value;
}

/** Write `strokesIncludedInLayout`, which only an auto layout takes (rule 58). */
export function setStrokesIncludedInLayout(state: NodeState, value: boolean): void {
  if (!isAutoLayout(state)) {
    throw new Error(
      "in set_strokesIncludedInLayout: Can only set strokesIncludedInLayout on nodes with layoutMode !== NONE"
    );
  }
  write(state, "strokesIncludedInLayout");
  state.strokesIncludedInLayout = value;
}

function requireAutoLayoutOrChild(state: NodeState, field: string): void {
  if (!isAutoLayout(state) && !isAutoLayout(state.parent)) {
    throw new Error(
      `${field} applies only to auto layout frames and their children, and ${state.id} is neither.`
    );
  }
}

/** Store a limit, or clear it with null, as the typings allow: positive, on auto layout (rule 16). */
function storeLimit(state: NodeState, field: LimitField, value: number | null): void {
  if (value !== null) {
    requireAutoLayoutOrChild(state, field);
    if (!(value > 0)) {
      throw new Error(`${field} must be positive, and ${value} is not.`);
    }
  }
  state.limits[field] = value === null ? null : f32(value);
}

export function setLimit(state: NodeState, field: LimitField, value: number | null): void {
  storeLimit(state, field, value);
  write(state, field);
  // Rule 44: a minimum width written on an instance lists both minimums among its overrides.
  if (field === "minWidth" && state.type === "INSTANCE") {
    markOverride(state, "minWidth");
    markOverride(state, "minHeight");
  }
}

/** Write the number a node field takes, as a binding or a literal write does. */
function setNumberField(state: NodeState, field: VariableBindableNodeField, value: number): void {
  switch (field) {
    case "width":
      resize(state, value, state.height);
      return;
    case "height":
      resize(state, state.width, value);
      return;
    case "minWidth":
    case "maxWidth":
    case "minHeight":
    case "maxHeight":
      storeLimit(state, field, value);
      return;
    case "itemSpacing":
      state.itemSpacing = f32(value);
      return;
    case "counterAxisSpacing":
      state.counterAxisSpacing = f32(value);
      return;
    case "paddingTop":
      state.padding.top = f32(value);
      return;
    case "paddingRight":
      state.padding.right = f32(value);
      return;
    case "paddingBottom":
      state.padding.bottom = f32(value);
      return;
    case "paddingLeft":
      state.padding.left = f32(value);
      return;
    case "topLeftRadius":
      state.radii.topLeft = f32(value);
      return;
    case "topRightRadius":
      state.radii.topRight = f32(value);
      return;
    case "bottomRightRadius":
      state.radii.bottomRight = f32(value);
      return;
    case "bottomLeftRadius":
      state.radii.bottomLeft = f32(value);
      return;
    case "strokeTopWeight":
      state.strokeWeights.top = f32(value);
      return;
    case "strokeRightWeight":
      state.strokeWeights.right = f32(value);
      return;
    case "strokeBottomWeight":
      state.strokeWeights.bottom = f32(value);
      return;
    case "strokeLeftWeight":
      state.strokeWeights.left = f32(value);
      return;
    case "opacity":
      state.opacity = f32(value);
      return;
    default:
      throw new Error(`The fake Figma file does not model binding ${field}.`);
  }
}

/** Bind or unbind a field of a layer that is not text. */
export function bindNodeField(
  state: NodeState,
  field: VariableBindableNodeField,
  variable: Variable | null
): void {
  const targets = bindingTargets(field);
  const length = state.type === "INSTANCE" && (field === "width" || field === "height") ? field : undefined;
  if (variable === null) {
    if (length !== undefined) {
      // An instance's own unbind keeps the length it shows, from then on (rule 56, G19).
      settled(state);
    }
    for (const target of targets) {
      state.bindings.delete(target);
    }
    if (length !== undefined) {
      state.unboundLengths.add(length);
      for (const field of ["width", "height", "boundVariables"]) {
        state.overridden.add(field);
      }
    }
    if (targets.some((target) => CORNERS.has(target))) {
      noteOverride(state, "radii");
    }
    write(state, `unbind ${field}`);
    return;
  }
  const bound = fileVariable(state.file, variable);
  requireType(bound, "FLOAT", field);
  if (length !== undefined) {
    state.unboundLengths.delete(length);
  }
  const value = resolveNumber(state.file, bound, state);
  for (const target of targets) {
    if (!keepsHug(state, target)) {
      setNumberField(state, target, value);
    }
    state.bindings.set(target, bound.id);
  }
  if (targets.some((target) => CORNERS.has(target))) {
    noteOverride(state, "radii");
  }
  write(state, `bind ${field}`);
}

/**
 * Whether a binding leaves an instance's length as it hugs: on 2026-10-23 a real file recorded a
 * height binding on a nested instance that hugged its height and kept the hug height, 26 (N4).
 */
function keepsHug(state: NodeState, field: VariableBindableNodeField): boolean {
  const axis = field === "width" ? "HORIZONTAL" : field === "height" ? "VERTICAL" : undefined;
  return state.type === "INSTANCE" && axis !== undefined && sizingOn(state, axis) === "HUG";
}

/** Bind or unbind a field of a text layer, every character's for a text field. */
export function bindTextField(state: NodeState, field: BindableField, variable: Variable | null): void {
  if (!isTextField(field)) {
    if (field === "characters") {
      throw new Error("The fake Figma file does not model binding characters.");
    }
    bindNodeField(state, field, variable);
    return;
  }
  bindWholeText(state, field, variable);
}

/**
 * A layer's box on its page: its position plus each ancestor's, up to the page. Where the layer or
 * a frame around it is turned, the box bounds the layer's turned corners (rule 26).
 */
export function absoluteBox(state: NodeState): Rect {
  const chain: NodeState[] = [];
  for (
    let current: NodeState | undefined = state;
    current !== undefined && current.type !== "PAGE";
    current = current.parent
  ) {
    chain.push(current);
  }
  const width = lengthOn(state, "HORIZONTAL");
  const height = lengthOn(state, "VERTICAL");
  if (chain.every((node) => node.rotation === 0)) {
    let x = 0;
    let y = 0;
    for (const node of chain) {
      x += node.x;
      y += node.y;
    }
    return { x, y, width, height };
  }
  const transform = chain.reduce<Transform>(
    (inner, outer) => compose(relativeTransform(outer), inner),
    [
      [1, 0, 0],
      [0, 1, 0],
    ]
  );
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x = 0, y = 0]) => mapPoint(transform, x, y));
  const left = Math.min(...corners.map((corner) => corner.x));
  const top = Math.min(...corners.map((corner) => corner.y));
  return {
    x: left,
    y: top,
    width: Math.max(...corners.map((corner) => corner.x)) - left,
    height: Math.max(...corners.map((corner) => corner.y)) - top,
  };
}

/**
 * The cosine and sine of a turn in degrees, exact where they are whole, as at each quarter turn, so
 * a half turn lands on whole pixels as the real file's did (rule 26).
 */
export function turnOf(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  // Adding 0 turns a -0 into 0.
  const whole = (value: number): number =>
    Math.abs(value - Math.round(value)) < 1e-12 ? Math.round(value) + 0 : value;
  return { cos: whole(Math.cos(radians)), sin: whole(Math.sin(radians)) };
}

/**
 * A rotation as Figma reads it back, counterclockwise from -180 to 180, so a whole turn more or
 * less reads the same (rule 26).
 */
export function readBackRotation(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

/** Rule 26: the typings' `atan2(-m10, m00)` reads `rotation` from this matrix. */
export function relativeTransform(state: NodeState): Transform {
  const { cos, sin } = turnOf(state.rotation);
  return [
    [cos, sin, state.x],
    [-sin, cos, state.y],
  ];
}

export function mapPoint(transform: Transform, x: number, y: number) {
  const [[m00, m01, m02], [m10, m11, m12]] = transform;
  return { x: m00 * x + m01 * y + m02, y: m10 * x + m11 * y + m12 };
}

/** The transform that applies `inner`, then `outer`. */
function compose(outer: Transform, inner: Transform): Transform {
  const [[a, b, c], [d, e, f]] = outer;
  const [[g, h, i], [j, k, l]] = inner;
  return [
    [a * g + b * j, a * h + b * k, a * i + b * l + c],
    [d * g + e * j, d * h + e * k, d * i + e * l + f],
  ];
}
