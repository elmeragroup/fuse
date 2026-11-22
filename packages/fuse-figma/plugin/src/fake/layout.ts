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
 *    written and when their sizes change, by a write, a binding or a reset, half each character's
 *    font size, since it measures no glyphs, and 0 for none. It resolves a bound size when the text
 *    binds it and not again when the text's modes change, so a mode change leaves the width. A fill
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
 *    that show it. No other frame lays out. An instance keeps the size it last settled at through a
 *    literal edit to its main. A parent's measure settles it the first time and once its modes differ
 *    from those it settled in, recording its size and modes together, so it hugs nested instances
 *    in its own modes (rule 8). A nested instance hugs through its chain of sources to the layout
 *    owner, unless an instance along it holds that length. A held length stays, as rule 56 holds one
 *    its modes gave another size once read. A sublayer whose main layer hugs nested instances hugs
 *    its own children the same way.
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
 *    its own are written, and sits where rule 63 puts it against its own parent, as the outer
 *    instance's badge followed the main's from 197 to 221. A bound length resolves in the modes of the layer that reads
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
 *    `setBoundVariable("width", v)` on the instance itself (G15). A length that follows a binding is
 *    no override: an instance whose width followed its main's binding, 40 beside the main, read 24
 *    under a frame pinned Dense and 40 once back, and listed no overrides either time (FM2, on
 *    2026-11-20). The fake holds an instance's lengths at its first read where a length that follows
 *    no binding differs from its main's, as rule 32 holds a resized one, and shows
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
 *    the centre 0.5px off (229 to 42 wide, 20.5 where the exact half is 21). That one reading cannot
 *    tell which way Figma rounds, so the fake refuses a read whose CENTER shift since the place was
 *    written is half a pixel, rather than approve a place the real file does not keep.
 * 62. `lockAspectRatio()` locks a layer's `targetAspectRatio` to its width and height as they stand,
 *    and `unlockAspectRatio()` sets it null. A `resize` or `resizeWithoutConstraints` of a locked
 *    layer moves the lock to the new width and height, as the typings say. On a scratch file on
 *    2026-11-19 a component locked at 448 by 252 read `{ x: 448, y: 252 }`, kept it once
 *    `combineAsVariants` made it a variant, and its instances read the same, and an instance switched
 *    to an unlocked variant read null (PG18). A 9:16 variant 176px wide read its height as the 32-bit
 *    float 312.8888854980469. An instance or a sublayer reads its source's lock, and the fake refuses a
 *    lock or an unlock on one, which no probe wrote, and leaves its source's lock as it is when the
 *    instance resizes. A clone keeps its source's lock, the fake's own choice, since no probe cloned
 *    a locked layer. The fake does not keep the ratio when an auto layout parent resizes a locked
 *    layer, as PG19 showed Figma does for an instance that fills its host's width.
 * 63. In an instance, a placed sublayer moves only as its parent's length changes, never as its own
 *    does. On 2026-11-19 a scratch file placed a close instance at MAX across and MIN down, 16px from
 *    the right and top of an auto layout column, its size bound to a density variable (PG14, PG14b).
 *    In the outer component's main, a density switch that grew the close from 24 to 32 moved it from
 *    x 260 to 252, as rule 47 keeps an end inset. In an instance of the outer component the same
 *    switch kept x 260, so the right inset fell from 16 to 8, and resizing that instance kept the 8.
 *    So the fake reads such a sublayer, until its own place is written, at its source's place, moved
 *    by the whole difference between its parent's length and its source's parent's under MAX and by
 *    half of it under CENTER. N11's badge and W5-P11's arrow kept their sizes in the instances that
 *    read them, so this rule places them where rules 47 and 59 do. PG14b changed the length by a
 *    density switch; no probe has changed it by a TEXT override on the outer instance, where the fake
 *    reads the same rule.
 * 64. An absolute auto layout frame places its one layer in flow by its padding and alignment. On
 *    2026-11-19 a scratch file held a frame with no fill and no clip, ABSOLUTE and STRETCH across an
 *    auto layout column, at x 0 and the column's width, HORIZONTAL with `primaryAxisAlignItems` MAX,
 *    padded 16 on the right and the top and hugging its height, around the close of rule 63 in flow
 *    (PG16). The close kept 16px from the column's right and top edges through resizes of the column,
 *    a density switch in an instance of the outer component that grew it from 24 to 32, and a BOOLEAN
 *    that hid and showed it, and the column's own layout did not change. So the fake reads the `x`
 *    and `y` of such a frame's one shown layer in flow from the frame's length, its padding and the
 *    layer's length: at the start padding under MIN, and against the end padding under MAX. A
 *    turned layer keeps that slot as rule 26 keeps one in any flow, so its `x` and `y` read the
 *    turned origin. A CENTER alignment, more than one layer in flow and a wrapping frame stay
 *    unmodelled, and reading one throws.
 *    Such a frame an instance shows takes its padding and alignment from its main's frame as that
 *    stands. On 2026-11-19 a change to the main frame's top padding moved the close in an instance of
 *    the outer component from 16 to 20 below the top, and the property value and fill a designer had
 *    set on that close stayed (PG20). So the fake reads a layer's padding and alignment from its
 *    source until the layer writes its own. No probe wrote them on an instance's layer. The fake
 *    keeps such a write when the main's changes, as rule 38 keeps an instance's other overrides
 *    (N3). It lists the write in `overrides` under the field's name in the typings'
 *    `NodeChangeProperty`, and `removeOverrides` clears it, so the layer follows its source again.
 *    A padding the layer binds counts as its own write. After `removeOverrides` the fake reads the
 *    source's padding and keeps the binding, which no probe has checked. A frame that hugs keeps the
 *    length its main's padding gives it after the instance's own padding write, as rule 32 hugs by
 *    the main's layout. A layer's `x` and `y`, its boxes on the page and its transform all read the
 *    place rules 47, 59, 63 and 64 give it.
 */

import { newGrid, placedCell } from "./grid.ts";
import {
  modeKey,
  ownNumber,
  resolveNumber,
  shownBinding,
  shownNumber,
  storeNumber,
  variableState,
} from "./modes.ts";
import { isHidden, listNumbers, markOverride } from "./overrides.ts";
import {
  bindingTargets,
  f32,
  isAutoLayout,
  isStoredNumber,
  isTextField,
  numberOwner,
  sourceOf,
  write,
} from "./state.ts";
import type {
  Axis,
  BindableField,
  Lengths,
  LimitField,
  NodeState,
  Sides,
  Sizing,
  StoredNumberField,
  Transform,
} from "./state.ts";
import { bindWholeText, requireHeldFonts } from "./text.ts";
import { childrenOf } from "./tree.ts";
import { fileVariable, requireType } from "./variables.ts";

/**
 * Resize a node, turn an auto layout frame's sizing modes to FIXED (rule 5), move its aspect lock to
 * the new size (rule 62), and stop it filling its auto layout parent (rule 14). A text whose height follows its lines keeps it (rule 19), and a
 * 0-wide one that fills across keeps the fill, which the width lets take over (rule 31).
 */
export function resize(state: NodeState, width: number, height: number): void {
  // A size Figma refuses claims nothing, so the layer's lengths claim ownership only once applied.
  applySize(state, width, height);
  ownSize(state);
}

/**
 * The size effects of a resize apart from the lengths it claims as the layer's own, which a binding
 * claims one axis at a time (rule 8).
 */
function applySize(state: NodeState, width: number, height: number): void {
  const followsLines = state.type === "TEXT" && state.textAutoResize === "HEIGHT";
  if (width < 0.01 || (!followsLines && height < 0.01)) {
    throw new Error(`Cannot resize ${state.id} to ${width} × ${height}: both must be at least 0.01.`);
  }
  const stuckFill = followsLines && state.width === 0 && fills(state, "HORIZONTAL");
  state.width = f32(width);
  if (!followsLines) {
    state.height = f32(height);
  }
  if (state.targetAspectRatio !== null && sourceOf(state) === undefined) {
    state.targetAspectRatio = { x: state.width, y: state.height };
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
  return anchorSource(state, axis).anchors[axis === "HORIZONTAL" ? "horizontal" : "vertical"];
}

/** The layer whose written place holds the anchor {@link anchorOf} reads: the layer, or its source. */
function anchorSource(state: NodeState, axis: Axis): NodeState {
  const written = state.overridden.has(axis === "HORIZONTAL" ? "x" : "y");
  return state.mirrorOf !== undefined && !written ? anchorSource(state.mirrorOf, axis) : state;
}

/** A layer's length and its parent's on an axis, each as a read gives it (rules 32, 47). */
function lengthsOn(state: NodeState, parent: NodeState, axis: Axis): Lengths {
  return { own: lengthOn(settled(state), axis), outer: lengthOn(settled(parent), axis) };
}

/**
 * A layer's `x` or `y` as a read gives it: where its anchor keeps it (rules 47, 59, 63), where an
 * absolute auto layout frame places it in flow (rule 64), else as stored. Every read of a place, a
 * box or a transform goes through it, so they agree.
 */
export function placeOn(state: NodeState, axis: Axis): number {
  return anchoredPlace(state, axis) ?? flowPlace(state, axis) ?? (axis === "HORIZONTAL" ? state.x : state.y);
}

/** The padding side each padding field names. */
const PADDING_SIDES = {
  paddingTop: "top",
  paddingRight: "right",
  paddingBottom: "bottom",
  paddingLeft: "left",
} as const;

/** A padding field of an auto layout frame. */
export type PaddingField = keyof typeof PADDING_SIDES;

/** An alignment field of an auto layout frame. */
export type AlignField = "primaryAxisAlignItems" | "counterAxisAlignItems";

/** The layer whose alignment a layer shows (rule 64): the layer once it writes its own, else its source's. */
function flowSource(state: NodeState, field: AlignField): NodeState {
  const source = sourceOf(state);
  return source !== undefined && !state.overridden.has(field) ? flowSource(source, field) : state;
}

/** A padding as a layer shows it, its source's until it writes its own (rules 8, 64). */
export function shownPadding(state: NodeState, field: PaddingField): number {
  return shownNumber(state, field);
}

/** An alignment as a layer shows it, its source's until it writes its own (rule 64). */
export function shownAlign<Field extends AlignField>(state: NodeState, field: Field): NodeState[Field] {
  return flowSource(state, field)[field];
}

/**
 * Where an anchored layer sits on an axis (rules 47, 59): under MAX its parent's length less its end
 * inset and its own length, under CENTER its parent's centre moved by its centre offset. A sublayer
 * an instance shows sits where its source does, moved by its parent's resize alone (rule 63). The place is
 * the layer's `x` or `y`, the origin of a turned layer's transform, which moves with the parent's
 * length as the unturned box's would.
 *
 * @returns The `x` or `y`, or undefined for a layer that keeps the one written.
 */
function anchoredPlace(state: NodeState, axis: Axis): number | undefined {
  const anchor = anchorOf(state, axis);
  const parent = state.parent;
  const kind = anchoredOn(state, axis);
  if (anchor === undefined || parent === undefined || kind === undefined) {
    return undefined;
  }
  const source = anchorSource(state, axis);
  if (source !== state && source.parent !== undefined) {
    return mirroredPlace(source, source.parent, parent, axis, kind);
  }
  const { own, outer } = lengthsOn(state, parent, axis);
  if (kind === "centre") {
    refuseHalfShift(anchorSource(state, axis).anchoredAt[axis === "HORIZONTAL" ? "horizontal" : "vertical"], {
      own,
      outer,
    });
  }
  return f32(kind === "end" ? outer - anchor - own : outer / 2 + anchor - own / 2);
}

/**
 * Where a sublayer an instance shows sits on an axis while its source holds its place (rule 63): at
 * the source's place, moved by the whole change from the source's parent's length to its own
 * parent's under MAX and by half of it under CENTER, whatever its own length.
 */
function mirroredPlace(
  source: NodeState,
  sourceParent: NodeState,
  parent: NodeState,
  axis: Axis,
  kind: "end" | "centre"
): number {
  const shift = lengthOn(settled(parent), axis) - lengthOn(settled(sourceParent), axis);
  const placed = placeOn(source, axis);
  if (kind === "centre") {
    refuseHalfShift({ own: 0, outer: 0 }, { own: 0, outer: shift });
  }
  return f32(placed + (kind === "end" ? shift : shift / 2));
}

/**
 * Where an absolute auto layout frame puts its one shown layer in flow on an axis (rule 64): at the
 * start padding under MIN, and against the end padding under MAX.
 *
 * @returns The `x` or `y`, or undefined for a hidden layer or one no such frame places.
 * @throws For an alignment, a flow or a wrap rule 64 does not model.
 */
function flowPlace(state: NodeState, axis: Axis): number | undefined {
  const frame = state.parent;
  if (
    frame === undefined ||
    !isAutoLayout(frame) ||
    frame.layoutMode === "GRID" ||
    frame.layoutPositioning !== "ABSOLUTE" ||
    state.layoutPositioning === "ABSOLUTE" ||
    isHidden(state)
  ) {
    return undefined;
  }
  const flow = childrenOf(frame).filter(
    (child) => child.layoutPositioning !== "ABSOLUTE" && !isHidden(child)
  );
  if (flow.length !== 1 || frame.layoutWrap === "WRAP") {
    throw new Error(
      `The fake Figma file does not model where the absolute frame ${frame.id} places ${String(flow.length)} layers in flow, or a wrapping one.`
    );
  }
  const align = shownAlign(
    frame,
    primaryOn(frame.layoutMode, axis) ? "primaryAxisAlignItems" : "counterAxisAlignItems"
  );
  const [start, end] =
    axis === "HORIZONTAL"
      ? [shownPadding(frame, "paddingLeft"), shownPadding(frame, "paddingRight")]
      : [shownPadding(frame, "paddingTop"), shownPadding(frame, "paddingBottom")];
  const own = settled(state);
  const turned = (slot: number): number =>
    turnedOrigin(state.rotation, lengthOn(own, "HORIZONTAL"), lengthOn(own, "VERTICAL"), axis, slot);
  if (align === "MIN") {
    return turned(start);
  }
  if (align === "MAX") {
    return turned(lengthOn(settled(frame), axis) - end - lengthOn(own, axis));
  }
  throw new Error(`The fake Figma file does not model ${align} in the absolute frame ${frame.id}.`);
}

/**
 * The `x` or `y` of a layer turned in its slot in an auto layout flow (rule 26): the origin that
 * keeps the turned box's centre where the unturned box's is, for an unturned box at `start`.
 */
export function turnedOrigin(
  rotation: number,
  width: number,
  height: number,
  axis: Axis,
  start: number
): number {
  const { cos, sin } = turnOf(rotation);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return axis === "HORIZONTAL"
    ? f32(start + halfWidth - (cos * halfWidth + sin * halfHeight))
    : f32(start + halfHeight - (cos * halfHeight - sin * halfWidth));
}

/**
 * Refuse a CENTER place whose shift since its anchor was written is no whole pixel: the real file kept
 * a CENTER shift whole and put the centre 0.5px off when an instance narrowed by an odd 187px, and one
 * reading cannot tell which way Figma rounds (rule 59, W5-P11b).
 */
function refuseHalfShift(at: Lengths | undefined, now: Lengths): void {
  if (at === undefined) {
    return;
  }
  const shift = (now.outer - at.outer - (now.own - at.own)) / 2;
  if (!Number.isInteger(shift)) {
    throw new Error(
      `The fake Figma file does not model a CENTER constraint shifting a layer ${String(shift)}px, half a pixel: Figma keeps the shift whole and W5-P11b does not pin which way it rounds.`
    );
  }
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
    state.anchoredAt.horizontal = lengths;
    state.x = value;
  } else {
    state.anchors.vertical = anchor;
    state.anchoredAt.vertical = lengths;
    state.y = value;
  }
}

/**
 * Note that an instance holds a width and a height of its own, which its main component's resize
 * leaves (rule 32), until a HUG on an axis lets that axis follow its content again, and that a
 * sublayer holds its own (rule 8).
 */
export function ownSize(state: NodeState): void {
  if (state.type === "INSTANCE") {
    state.overridden.add("width");
    state.overridden.add("height");
    state.heldByModes = false;
    return;
  }
  // A sublayer holds the lengths written on it from then on, apart from its main layer's (rule 8).
  ownNumber(state, "width");
  ownNumber(state, "height");
}

/** Claim one length as the layer's own, as a binding on that axis does (rules 8, 32). */
function ownLength(state: NodeState, field: "width" | "height"): void {
  if (state.type === "INSTANCE") {
    state.overridden.add(field);
    state.heldByModes = false;
  } else {
    ownNumber(state, field);
  }
}

/**
 * Resize the instance a text sublayer sits in where a range write changed the text's width and the
 * instance's main hugs its content, and hold the instance's size, as a real file listed `width` and
 * `height` on the instance after a range write grew its label (rule 53, FT4).
 *
 * @param text - The text sublayer.
 * @param before - Its width before the write.
 */
export function fitInstanceToText(text: NodeState, before: number): void {
  const instance = text.parent;
  const source = instance === undefined ? undefined : sourceOf(instance);
  if (text.width === before || instance?.type !== "INSTANCE" || source === undefined) {
    return;
  }
  const owner = layoutOwner(source);
  if (!isAutoLayout(owner)) {
    return;
  }
  for (const axis of ["HORIZONTAL", "VERTICAL"] as const) {
    if (owner[modeOn(owner, axis)] === "AUTO") {
      const length = huggedLength(instance, axis, owner);
      if (axis === "HORIZONTAL") {
        instance.width = length;
      } else {
        instance.height = length;
      }
    }
  }
  ownSize(instance);
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

/**
 * Whether an axis is the primary one of an auto layout: its direction, and a grid's width, which the
 * fake gives a grid's primary sizing mode and its layers' `layoutGrow` (rule 61).
 */
export function primaryOn(mode: FrameNode["layoutMode"], axis: Axis): boolean {
  return mode === axis || (mode === "GRID" && axis === "HORIZONTAL");
}

/** The sizing mode of an auto layout frame that covers an axis: the primary one along its direction. */
function modeOn(state: NodeState, axis: Axis): "primaryAxisSizingMode" | "counterAxisSizingMode" {
  return primaryOn(state.layoutMode, axis) ? "primaryAxisSizingMode" : "counterAxisSizingMode";
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
  return primaryOn(parent.layoutMode, axis) ? state.layoutGrow === 1 : state.layoutAlign === "STRETCH";
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
  // The size and the modes it was measured in are recorded together (rules 8, 32).
  state.settledModes = modeKey(state);
  const held = (axis: Axis): boolean => state.overridden.has(lengthOverride(axis));
  const free = !held("HORIZONTAL") && !held("VERTICAL");
  const following = new Set<Axis>();
  for (const axis of ["HORIZONTAL", "VERTICAL"] as const) {
    const bound = boundOfInstance(state, axis);
    if (bound !== undefined) {
      following.add(axis);
    }
    if (bound !== undefined || !held(axis)) {
      const length = bound ?? ownHug(state, source, axis) ?? lengthOn(source, axis);
      if (axis === "HORIZONTAL") {
        state.width = length;
      } else {
        state.height = length;
      }
    }
  }
  // An instance its modes give another size than its main holds its lengths from then on (rule 56),
  // unless the length that differs follows a binding (FM2). A size its own numbers give it in the
  // modes its main reads is no mode hold (FM3).
  const differs = (axis: Axis): boolean =>
    !following.has(axis) && (axis === "HORIZONTAL" ? state.width : state.height) !== lengthOn(source, axis);
  const otherModes = modeKey(state) !== modeKey(source);
  if (free && otherModes && state.mirrorOf === undefined && (differs("HORIZONTAL") || differs("VERTICAL"))) {
    ownSize(state);
    state.heldByModes = true;
  }
  return state;
}

/**
 * The length an instance shows bound through its main, in its own modes, unless it unbound that
 * axis itself (rules 47, 56). A hugging parent measures an instance by it as a read gives it (rule 8).
 */
function boundOfInstance(state: NodeState, axis: Axis): number | undefined {
  const source = sourceOf(state);
  return state.type !== "INSTANCE" || source === undefined || state.unboundLengths.has(lengthOverride(axis))
    ? undefined
    : boundThrough(source, state, axis);
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
  if (!hugsThrough(source, axis)) {
    return undefined;
  }
  for (const child of childrenOf(state)) {
    if (child.type === "INSTANCE") {
      settled(child);
    }
  }
  return huggedLength(state, axis, layoutOwner(source));
}

/**
 * Whether a layer's source hugs an axis around nested instances, following the chain of instances
 * between to its layout owner, as a nested instance's source is the instance its main holds (rule 32).
 * An instance along the way that holds its own length on the axis stops the hug.
 */
function hugsThrough(
  source: NodeState,
  axis: Axis,
  hugs: (owner: NodeState, axis: Axis) => boolean = hugsInstances
): boolean {
  let node = source;
  for (let next = sourceOf(node); node.type === "INSTANCE" && next !== undefined; next = sourceOf(node)) {
    if (node.overridden.has(lengthOverride(axis))) {
      return false;
    }
    node = next;
  }
  return hugs(node, axis);
}

/**
 * Apply a write on a layer and, on a hugging instance whose size it changes, record the new size it
 * hugs and list its `width` and `height`, which it still hugs: on 2026-11-20 `itemSpacing = 7` on an
 * instance of a hugging row listed both beside `itemSpacing` (FM3). Any other layer applies alone.
 */
export function noteHugChange(state: NodeState, apply: () => void): void {
  const source = sourceOf(state);
  if (state.type !== "INSTANCE" || source === undefined) {
    apply();
    return;
  }
  // FM3's row hugged two fixed frames, which the fake measures here though it lays out no such frame.
  const hug = (axis: Axis): number | undefined =>
    state.overridden.has(lengthOverride(axis)) || !hugsThrough(source, axis, hugsAxis)
      ? undefined
      : huggedLength(state, axis, layoutOwner(source));
  const before = [hug("HORIZONTAL"), hug("VERTICAL")];
  apply();
  const [width, height] = [hug("HORIZONTAL"), hug("VERTICAL")];
  if (width === before[0] && height === before[1]) {
    return;
  }
  state.width = width ?? state.width;
  state.height = height ?? state.height;
  state.overridden.add("hugged");
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
  const bound = lengthBinding(state, field);
  return bound === undefined || keepsHug(state, field)
    ? undefined
    : f32(resolveNumber(state.file, variableState(state.file, bound), consumer));
}

/**
 * The variable a layer binds a length to: its own, or a sublayer's main layer's as that stands, until
 * the sublayer holds its own length (rule 8). An instance's goes through `boundOfInstance`.
 */
function lengthBinding(state: NodeState, field: "width" | "height"): string | undefined {
  for (let node = state; ;) {
    const own = node.bindings.get(field);
    const source = node.type === "INSTANCE" ? undefined : sourceOf(node);
    if (own !== undefined || source === undefined || node.overridden.has(numberOwner(field))) {
      return own;
    }
    node = source;
  }
}

/**
 * The length a layer is given on an axis before any layout: a bound one in its modes, an instance's
 * through its main, or the one it stores (rule 8).
 */
function givenLength(state: NodeState, axis: Axis): number {
  return boundLength(state, state, axis) ?? boundOfInstance(state, axis) ?? storedLength(state, axis);
}

/**
 * The length a layer stores on an axis: its own, or a sublayer's main layer's as that stands until
 * the sublayer holds its own length (rule 8), which a resize, a rescale or a text measure gives it.
 */
function storedLength(state: NodeState, axis: Axis): number {
  const field = lengthOverride(axis);
  let node = state;
  for (let source = sourceOf(node); ; source = sourceOf(node)) {
    if (node.type === "INSTANCE" || source === undefined || node.overridden.has(numberOwner(field))) {
      return axis === "HORIZONTAL" ? node.width : node.height;
    }
    node = source;
  }
}

/**
 * The length a sublayer hugs on an axis its main layer hugs around nested instances, measured from
 * its own children and its numbers in its modes, until it holds its own length (rules 8, 32).
 */
function sublayerHug(state: NodeState, axis: Axis): number | undefined {
  if (state.type === "INSTANCE" || state.mirrorOf === undefined) {
    return undefined;
  }
  const owner = layoutOwner(state);
  return state.overridden.has(numberOwner(lengthOverride(axis))) || !hugsInstances(owner, axis)
    ? undefined
    : huggedLength(state, axis, owner);
}

/** Whether a frame or component of the file's own is an auto layout that hugs an axis without wrapping. */
function hugsAxis(state: NodeState, axis: Axis): boolean {
  return (
    (state.type === "FRAME" || state.type === "COMPONENT") &&
    state.mirrorOf === undefined &&
    isAutoLayout(state) &&
    state.layoutWrap !== "WRAP" &&
    state[modeOn(state, axis)] === "AUTO"
  );
}

/**
 * Whether a frame or component sizes an axis from its children as they stand (rule 32): it hugs that
 * axis without wrapping and holds an instance of a set's variant in its flow, as a component that
 * nests another set's variant did on a real file (N2). The fake lays out no other frame.
 */
function hugsInstances(state: NodeState, axis: Axis): boolean {
  return (
    hugsAxis(state, axis) &&
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
 * child that does not fill that axis and its padding. A hidden layer, by a property or a write, leaves the
 * layout, as it did on a real file (PB), and so does an absolute one (rule 24). An instance lays out
 * its own children by its main's layout as that stands, so `layout` names the node whose direction,
 * direction and stroke apply (rule 47). Its padding and spacing are the numbers it shows, each
 * bound one in its own modes (rule 8).
 */
function huggedLength(state: NodeState, axis: Axis, layout: NodeState = state): number {
  const flow = childrenOf(state).filter(
    (child) => child.layoutPositioning !== "ABSOLUTE" && !isHidden(child)
  );
  const padding =
    axis === "HORIZONTAL"
      ? inset(state, "left", layout) + inset(state, "right", layout)
      : inset(state, "top", layout) + inset(state, "bottom", layout);
  if (layout.layoutMode === axis) {
    const lengths = flow.reduce((sum, child) => sum + lengthOn(child, axis), 0);
    return padding + lengths + shownNumber(state, "itemSpacing") * Math.max(0, flow.length - 1);
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
  const room = lengthOn(state, "HORIZONTAL") - inset(state, "left") - inset(state, "right");
  const spacing = shownNumber(state, "itemSpacing");
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
    if (count > 0 && rowWidth + spacing + width > room) {
      rows.push(rowHeight);
      rowWidth = 0;
      rowHeight = 0;
      count = 0;
    }
    rowWidth += (count > 0 ? spacing : 0) + width;
    rowHeight = Math.max(rowHeight, height);
    count += 1;
  }
  if (count > 0) {
    rows.push(rowHeight);
  }
  const between = Math.max(0, rows.length - 1) * (shownNumber(state, "counterAxisSpacing") ?? 0);
  return inset(state, "top") + rows.reduce((sum, row) => sum + row, 0) + between + inset(state, "bottom");
}

/**
 * What an auto layout keeps clear inside one edge: its padding, and the weight of a stroke it holds on
 * that side while `strokesIncludedInLayout` is true (rule 46, PS). A frame without a stroke keeps its
 * padding alone: in PS4 a stroke-less hugging row with the field true, padding 0, around a fixed
 * 20 × 20 child measured 20 × 20 at weight 1 and at weight 4, and the same row with a SOLID INSIDE
 * stroke of weight 4 measured 28 × 28. The padding and weight are the numbers the layer shows (rule
 * 8), and `layout` names the layer whose strokes apply, an instance's main's layer (rule 47).
 */
function inset(state: NodeState, side: keyof Sides, layout: NodeState = state): number {
  const stroked = layout.strokesIncludedInLayout && layout.strokes.length > 0;
  const [padding, weight] = INSET_FIELDS[side];
  return shownNumber(state, padding) + (stroked ? shownNumber(state, weight) : 0);
}

/** The padding and the stroke weight each side of an auto layout keeps clear. */
const INSET_FIELDS = {
  top: ["paddingTop", "strokeTopWeight"],
  right: ["paddingRight", "strokeRightWeight"],
  bottom: ["paddingBottom", "strokeBottomWeight"],
  left: ["paddingLeft", "strokeLeftWeight"],
} as const satisfies Record<keyof Sides, readonly [PaddingField, StoredNumberField]>;

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
  // An instance measured for the first time, or in modes other than those it last settled in, settles
  // first; a literal edit to its main waits for its next settle (rules 8, 32, PI).
  if (state.type === "INSTANCE" && sourceOf(state) !== undefined && state.settledModes !== modeKey(state)) {
    settled(state);
  }
  const given = boundLength(state, state, axis) ?? boundOfInstance(state, axis) ?? storedLength(state, axis);
  const grid =
    state.layoutMode === "GRID" && state.type !== "INSTANCE" && state[modeOn(state, axis)] === "AUTO"
      ? huggedGrid(state, axis)
      : undefined;
  const own =
    grid ?? (hugsInstances(state, axis) ? huggedLength(state, axis) : (sublayerHug(state, axis) ?? given));
  const parent = state.parent;
  // A layer that fills its grid cell is as long as the cell's track (rule 61).
  if (parent?.layoutMode === "GRID" && fills(state, axis) && !isHidden(state)) {
    const cell = placedCell(parent, state);
    const track = axis === "HORIZONTAL" ? cell?.column : cell?.row;
    const length = track === undefined || track < 0 ? undefined : gridTracks(parent, axis)[track];
    if (length !== undefined) {
      return length;
    }
  }
  // A fill never widens a 0-wide text (rule 31).
  const stuck = state.type === "TEXT" && axis === "HORIZONTAL" && own === 0;
  if (
    stuck ||
    parent === undefined ||
    !isAutoLayout(parent) ||
    parent.layoutMode === axis ||
    parent.layoutMode === "GRID" ||
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
    return isHidden(state) ? "FIXED" : "FILL";
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
  if (state.parent !== undefined && primaryOn(state.parent.layoutMode, axis)) {
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
  if (state.parent?.layoutMode === "GRID") {
    retainTracks(state.parent);
  }
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
    if (state.parent !== undefined && primaryOn(state.parent.layoutMode, axis)) {
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
    if (state.parent !== undefined && primaryOn(state.parent.layoutMode, axis)) {
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

/**
 * Write `layoutMode`: turning auto layout on includes the strokes in it (rule 57), and turning into a
 * grid gives the frame a new grid and fixes its sizing on both axes (rule 61, PG7).
 */
export function setLayoutMode(state: NodeState, value: FrameNode["layoutMode"]): void {
  write(state, "layoutMode");
  if (state.layoutMode === "NONE" && value !== "NONE") {
    state.strokesIncludedInLayout = true;
  }
  if (value === "GRID" && state.layoutMode !== "GRID") {
    state.grid = newGrid(state.grid);
    state.primaryAxisSizingMode = "FIXED";
    state.counterAxisSizingMode = "FIXED";
  }
  state.layoutMode = value;
}

/**
 * The lengths of a grid's tracks along an axis (rule 61), read without changing the file. A FIXED
 * track is its value. A HUG track is its longest layer that does not fill that axis, so a filling
 * layer never sets it, and one that holds only filling layers keeps the length {@link retainTracks}
 * kept for it (PG2). The FLEX tracks share what the grid's length leaves past its padding, the other
 * tracks and the gaps, by their values, whatever their layers hold, which overflow a track too short
 * for them (PG12).
 */
function gridTracks(grid: NodeState, axis: Axis): number[] {
  const across = axis === "HORIZONTAL";
  const sizes = across ? grid.grid.columnSizes : grid.grid.rowSizes;
  const flow = childrenOf(grid).filter((child) => child.layoutPositioning !== "ABSOLUTE" && !isHidden(child));
  const held = grid.grid.held[axis];
  const lengths = sizes.map((size, track) => {
    if (size.type === "FIXED") {
      return size.value ?? 0;
    }
    if (size.type === "FLEX") {
      return undefined;
    }
    const setting = flow
      .filter((child) => {
        const cell = placedCell(grid, child);
        return (across ? cell?.column : cell?.row) === track && !fills(child, axis);
      })
      .map((child) => lengthOn(child, axis));
    return setting.length === 0 ? (held[track] ?? 0) : Math.max(...setting);
  });
  const gap = shownNumber(grid, across ? "gridColumnGap" : "gridRowGap");
  const padding = across
    ? inset(grid, "left") + inset(grid, "right")
    : inset(grid, "top") + inset(grid, "bottom");
  if (!lengths.includes(undefined)) {
    return lengths.map((length) => length ?? 0);
  }
  const set = lengths.reduce<number>((sum, length) => sum + (length ?? 0), 0);
  // FLEX tracks share the length the grid is given, by its parent too (rule 8). A grid with a FLEX
  // track does not hug that axis, so the length is no measure of these tracks.
  const room = lengthOn(grid, axis) - padding - set - gap * Math.max(0, sizes.length - 1);
  const shares = sizes.reduce((sum, size) => sum + (size.type === "FLEX" ? (size.value ?? 1) : 0), 0);
  // No probe has shown how Figma shares out FLEX tracks whose shares sum to 0.
  if (shares === 0) {
    throw new Error("The fake Figma file does not model FLEX tracks whose shares sum to 0.");
  }
  return lengths.map((length, track) => length ?? (Math.max(0, room) * (sizes[track]?.value ?? 1)) / shares);
}

/**
 * Keep the length of each of a grid's HUG tracks as it stands, which a track keeps once every layer
 * in it fills it (PG2). The fake keeps them when a layer of the grid changes its sizing, the write
 * after which a track can hold only filling layers.
 */
export function retainTracks(grid: NodeState): void {
  for (const axis of ["HORIZONTAL", "VERTICAL"] as const) {
    grid.grid.held[axis] = gridTracks(grid, axis);
  }
}

/**
 * A grid's length on an axis it hugs, its tracks, gaps and padding, or undefined where a FLEX track
 * shares that axis, which keeps the grid's length (PG3).
 */
function huggedGrid(grid: NodeState, axis: Axis): number | undefined {
  const sizes = axis === "HORIZONTAL" ? grid.grid.columnSizes : grid.grid.rowSizes;
  if (sizes.some((size) => size.type === "FLEX")) {
    return undefined;
  }
  const tracks = gridTracks(grid, axis);
  const gap = shownNumber(grid, axis === "HORIZONTAL" ? "gridColumnGap" : "gridRowGap");
  const padding =
    axis === "HORIZONTAL"
      ? inset(grid, "left") + inset(grid, "right")
      : inset(grid, "top") + inset(grid, "bottom");
  return padding + tracks.reduce((sum, length) => sum + length, 0) + gap * Math.max(0, tracks.length - 1);
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
  // Rule 44: a minimum width written on an instance lists both minimums among its overrides, and a
  // maximum width both maximums.
  if (field === "minWidth" && state.type === "INSTANCE") {
    markOverride(state, "minWidth");
    holdHeightLimit(state, "minHeight");
  }
  if (field === "maxWidth" && state.type === "INSTANCE") {
    markOverride(state, "maxWidth");
    holdHeightLimit(state, "maxHeight");
  }
}

/**
 * Whether a `minHeight` write is a null on an instance that shows null and holds no `minHeight` of
 * its own. On 2026-11-21 such a write listed no override, and the instance followed its main's next
 * value, 30 (rule 44, MH's `jA`). No probe wrote such a null on `maxHeight`.
 */
export function leavesMinHeight(state: NodeState, value: number | null): boolean {
  return (
    value === null &&
    state.type === "INSTANCE" &&
    !state.overridden.has("minHeight") &&
    !state.overridden.has(numberOwner("minHeight")) &&
    !state.bindings.has("minHeight") &&
    shownNumber(state, "minHeight") === null
  );
}

/**
 * List the height limit a width limit's write pairs with, and keep the number it shows then as the
 * instance's own (rule 44, MH).
 */
function holdHeightLimit(state: NodeState, field: "minHeight" | "maxHeight"): void {
  if (!state.overridden.has(field)) {
    storeNumber(state, field, shownNumber(state, field));
  }
  markOverride(state, field);
}

/** Write the number a node field takes, as a binding does: a length resizes and a limit is checked. */
function setNumberField(state: NodeState, field: VariableBindableNodeField, value: number): void {
  switch (field) {
    case "width":
      applySize(state, value, givenLength(state, "VERTICAL"));
      ownLength(state, "width");
      return;
    case "height":
      applySize(state, givenLength(state, "HORIZONTAL"), value);
      ownLength(state, "height");
      return;
    case "minWidth":
    case "maxWidth":
    case "minHeight":
    case "maxHeight":
      storeLimit(state, field, value);
      return;
    default:
      if (!isStoredNumber(field)) {
        throw new Error(`The fake Figma file does not model binding ${field}.`);
      }
      storeNumber(state, field, value);
  }
}

/** The numbers a layer shows on the stored number fields among these, before a write makes them its own. */
export function keptNumbers(
  state: NodeState,
  targets: readonly VariableBindableNodeField[]
): [StoredNumberField, number | null][] {
  return targets
    .filter(isStoredNumber)
    .map((field): [StoredNumberField, number | null] => [field, shownNumber(state, field)]);
}

/**
 * Make the fields a binding or an unbind sets the layer's own, once it has set them: a padding
 * listed as an override from then on (rule 64), and each number and a sublayer's length apart from
 * its source's (rule 8).
 */
function ownTargets(state: NodeState, targets: readonly VariableBindableNodeField[]): void {
  for (const target of targets) {
    if (Object.hasOwn(PADDING_SIDES, target)) {
      markOverride(state, target);
    }
    if (
      isStoredNumber(target) ||
      (state.type !== "INSTANCE" && (target === "width" || target === "height"))
    ) {
      ownNumber(state, target);
    }
  }
}

/**
 * Bind or unbind a field of a layer that is not text. A number's binding lists a hugging
 * instance's lengths where it changes its size, as a write does (FM3), and a whole `strokeWeight`
 * lists `strokeWeight` beside its sides.
 */
export function bindNodeField(
  state: NodeState,
  field: VariableBindableNodeField,
  variable: Variable | null
): void {
  if (!bindingTargets(field).some(isStoredNumber)) {
    bindField(state, field, variable);
    return;
  }
  noteHugChange(state, () => bindField(state, field, variable));
  if (field === "strokeWeight") {
    markOverride(state, "strokeWeight");
  }
}

function bindField(state: NodeState, field: VariableBindableNodeField, variable: Variable | null): void {
  const targets = bindingTargets(field);
  const length = state.type === "INSTANCE" && (field === "width" || field === "height") ? field : undefined;
  const axis = field === "width" ? "HORIZONTAL" : field === "height" ? "VERTICAL" : undefined;
  // An unbind keeps the numbers and the length the layer shows as its own (rule 8).
  const kept = variable === null ? keptNumbers(state, targets) : [];
  if (variable === null) {
    if (length !== undefined) {
      // An instance's own unbind keeps the length it shows, from then on (rule 56, G19).
      settled(state);
    }
    // The length the layer shows, laid out and settled, before the binding goes.
    const shownLength = axis === undefined ? undefined : lengthOn(state, axis);
    for (const target of targets) {
      state.bindings.delete(target);
    }
    ownTargets(state, targets);
    for (const [target, value] of kept) {
      storeNumber(state, target, value);
    }
    if (shownLength !== undefined) {
      if (axis === "HORIZONTAL") {
        state.width = shownLength;
      } else {
        state.height = shownLength;
      }
    }
    if (length !== undefined) {
      state.unboundLengths.add(length);
      for (const field of ["width", "height", "boundVariables"]) {
        state.overridden.add(field);
      }
    }
    listNumbers(state, targets.filter(isStoredNumber));
    write(state, `unbind ${field}`);
    return;
  }
  const bound = fileVariable(state.file, variable);
  requireType(bound, "FLOAT", field);
  if (followsSourceBinding(state, field, bound.id)) {
    // Rule 44: a held height limit bound to the variable its source shows keeps its number and
    // follows the source's next binding (MH).
    state.bindings.delete(field);
    write(state, `bind ${field}`);
    return;
  }
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
  ownTargets(state, targets);
  listNumbers(state, targets.filter(isStoredNumber));
  write(state, `bind ${field}`);
}

/**
 * Whether a binding is of the variable an instance's source shows on a height limit a literal width
 * write made the instance's own (rule 44).
 */
function followsSourceBinding(state: NodeState, field: VariableBindableNodeField, id: string): boolean {
  const source = sourceOf(state);
  return (
    (field === "minHeight" || field === "maxHeight") &&
    state.type === "INSTANCE" &&
    state.overridden.has(field) &&
    source !== undefined &&
    shownBinding(source, field) === id
  );
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
      x += placeOn(node, "HORIZONTAL");
      y += placeOn(node, "VERTICAL");
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
    [cos, sin, placeOn(state, "HORIZONTAL")],
    [-sin, cos, placeOn(state, "VERTICAL")],
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
