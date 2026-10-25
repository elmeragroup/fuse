/**
 * An in-memory Figma file behind the parts of the Plugin API that the components plugin calls,
 * for tests that run `reconcileKit` end to end and for the planners' unit tests. The file starts as a synced file: it holds the
 * variable collections `figma:sync` writes, with their modes, values and aliases, and one empty
 * page. Variables, collections, modes and nodes get ids in the order the file makes them, so a
 * test sees the same ids on every run.
 *
 * Every node, variable, collection and API object sits behind a guard that throws for a member
 * the fake does not model, so a plugin change that reads or writes something new fails here
 * instead of passing on an `undefined`. Every write lands in a log, so a test can tell that a
 * run stopped before its first write.
 *
 * The fake models the Figma rules below. Each rule a real file showed in 2026-10 names that run.
 * Rules 12 to 45 name the probe behind each, from net-zero probes on the test file `Elmera Fuse -
 * Import test` from 2026-10-22 to 2026-10-25: P0 and P0b read the kit's nodes, P1 to P9, PB, PR,
 * PQ, PD, PL, PF, PH, PZ, PI, PZ2, N1 to N5, NS, NA, NH, PI2, PI3 and PH3 built nodes on a scratch page, and
 * P9b stored images and built no node.
 *
 * 1. `setBoundVariableForPaint` returns the paint with its opacity set to the alpha of the bound
 *    COLOR variable in the collections' default modes, whatever opacity it was given. Two runs
 *    on a real file on 2026-10-19 wrote `error` at 10% and read it back at 100%.
 * 2. Assigning `effects`: an effect whose color binding is new to the node stores the value the
 *    variable takes in the node. An effect written with a color binding the node already held
 *    keeps the color written. On a real file on 2026-10-20, 28 focus rings bound to `ring`
 *    kept the black an earlier run wrote. A radius or spread binding keeps the value written.
 * 3. A drop shadow's spread draws only on a frame, component or instance that clips its content
 *    and has a visible fill, one with `visible` not false and an opacity above 0. On a real file
 *    on 2026-10-20 the ghost and link focus rings drew nothing over a fill at alpha 0, and a test
 *    frame drew its ring once the fill reached 0.001. The typings' `DropShadowEffect.spread`
 *    says the same. {@link drawsShadowSpread} reports it, and the stored spread stays as written.
 * 4. A component set keeps each variant property's values in an order of its own. A new set
 *    lists them in the order its children first show them, a value added later goes last, and
 *    moving the children or renaming a value leaves it where it is. Its `defaultVariant` is the
 *    top-left child, the smallest y and then the smallest x. On a real file on 2026-10-20 a run
 *    that appended xs and lg listed the sizes as default, sm, xs, lg and made xs the default, a
 *    later run that moved the variants into spec order left that list as it was, and a test set
 *    kept a renamed value in its slot.
 * 5. `resize` and `resizeWithoutConstraints` on an auto layout frame set both sizing modes to
 *    FIXED. `planLayoutSizing` in `fields.ts` writes the sizing again after a length for this
 *    reason, as the plugin has since 4734b75e on 2026-10-19. Binding `width` or `height` resizes
 *    the same way.
 * 6. `createNodeFromSvg` returns a frame the size of the markup's `width` and `height`, painted
 *    white and clipping, on the current page. Its children are the drawn elements, each a
 *    vector named after its `id`, or `Vector`, as a real run showed on 2026-10-20. The fake
 *    leaves out what `defs`, `clipPath` and `mask` hold and lifts the elements out of groups.
 *    It reads no geometry, so every vector covers the whole drawing.
 * 7. A text write needs every font the layer holds loaded, and a font write needs only the new
 *    font, as the typings and Figma's text guide say and as the plugin relies on since
 *    e152633d and 11df4d6e on 2026-10-19. `loadFontAsync` rejects a font the test marks
 *    unavailable. Clearing a text binding writes no font, so it needs none.
 * 8. `resolveForConsumer` reads each collection in the mode the node or its nearest ancestor
 *    pins, or in the collection's default mode, and follows aliases across collections, each
 *    in the mode the node reads for the alias target's collection. `fuse-variable-set.ts`
 *    builds its theme axes on this rule.
 * 9. `resize` moves and resizes each child as its constraints say: `MIN` keeps the child where
 *    it is, `SCALE` scales its position and size by the parent's ratio, and `STRETCH` keeps its
 *    distance to both edges, so its size grows by what the parent's grows. A child that changes
 *    size resizes its own children the same way. An auto layout frame places the children in its
 *    flow by its layout instead, which the fake leaves as they are, and constrains only its
 *    absolute children (rule 24). The fake throws for `MAX` and `CENTER`, which it does not
 *    model. `resizeWithoutConstraints` leaves the children as they are. Figma's reference pages
 *    for `resize` and `resizeWithoutConstraints` say so, and the icon components rely on it to
 *    bring a glyph back with its component.
 * 10. A text layer keeps a font, size, line height and text field bindings per character, as
 *    the typings' range methods and Figma's guide to mixed styles describe. `fontName`,
 *    `fontSize` and `lineHeight` are `figma.mixed` when the characters differ, and
 *    `getRangeBoundVariable` is `figma.mixed` when the characters of the range bind different
 *    variables or some bind none, while `boundVariables` lists each alias any character binds.
 *    Writing `characters` gives every new character the first character's style. A range
 *    binding or font write restyles only its range, and a layer-wide write or binding every
 *    character. A `fontWeight` binding gives each character of its range the style its
 *    family names for the weight, which needs that font loaded, as Figma's guide to
 *    typography variables says. The fake names the style by `WEIGHT_STYLES`, Thin for 100
 *    up to Black for 900, and throws for another weight or a held style the table lacks.
 * 11. `resolvedVariableModes` lists only the collections the layer's subtree reads: those of
 *    the variables a field, text range, paint or effect binds somewhere under it, and those
 *    their aliases reach. The typings say "each variable collection in this file".
 *    `explicitVariableModes` lists every pin. On a real file on 2026-10-21 a Badge preview
 *    pinned `Fuse density` to Auto beside its theme. It resolved `Fuse tokens`, which its layers
 *    bind, and the brand, segment and variant collections those tokens alias through, but
 *    neither `Fuse density`, which no Badge layer binds, nor `Fuse primitives`. The Button and
 *    Toggle previews, whose sets bind density, resolved Auto.
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
 * 19. A text's sizing and its `textAutoResize` move together, as a real file showed on 2026-10-22
 *    (P3). FILL across a WIDTH_AND_HEIGHT text in a row switches it to HEIGHT and fills the row.
 *    Writing WIDTH_AND_HEIGHT on a text that fills keeps it HEIGHT and filling. A resize of a
 *    HEIGHT text fixes its width and keeps its height on its lines, and stops a fill as rule 14
 *    says, except on a 0-wide text (rule 31). No probe wrote HUG or FIXED on a text, or FILL down
 *    one. The fake takes HUG or FIXED only where the auto resize already reads it, so the write
 *    only stops a fill, and throws for the rest. A sizing write needs the text's fonts, as an auto
 *    resize write does.
 * 20. `textTruncation` and `maxLines`, as a real file showed on 2026-10-22 (P4). A `maxLines`
 *    write while truncation is DISABLED changes nothing, and the maximum reads null. ENDING on a
 *    text with no maximum reads `maxLines` 1, and null under ENDING is accepted. `maxLines` takes
 *    null or at least 1, as the typings say. Turning truncation DISABLED drops the maximum, since a
 *    text that does not truncate read null in P0 and P4. P4 ran with every font loaded, so it did
 *    not settle whether either write needs the text's fonts. The fake requires them, as for
 *    `textAutoResize`, so Plan fails where Apply might.
 * 21. `textAlignHorizontal` and `textAlignVertical` need the text's fonts, as the typings say. A
 *    new text sets its lines from the top left, LEFT and TOP. On 2026-10-22 all 420 labels of the
 *    real file's Button and Icon button sets read LEFT and TOP, and the plugin had written no
 *    alignment when it made them, so those are Figma's defaults for a new text (P0b).
 * 22. `createImage` stores an image under the SHA-1 of its bytes in lowercase hex, and
 *    `getImageByHash` finds it there. On 2026-10-22 a real file decoded a PNG with `base64Decode`,
 *    gave Avatar's portrait the hash `shasum -a 1` gives its bytes, found the image by that hash, and
 *    returned null for an unknown one (P9, P9b). It stored the portrait's first 100 bytes and
 *    refused its 8-byte signature alone with `in createImage: Image type is unsupported` (P9b), so
 *    Figma reads the header, not the whole file. The fake stores bytes that open with a PNG
 *    signature and a whole IHDR chunk, and throws that error for any other bytes. No probe stored
 *    a JPEG or a GIF, a PNG cut inside its IHDR chunk, or one over the 4096px the reference states,
 *    so the fake takes the narrow reading. Storing an image changes the file, though an image is no
 *    node, so the fake logs it as a write, and a Plan that stores one fails a check for no writes.
 * 23. An IMAGE paint reads back with Figma's defaults filled in. On 2026-10-22 a real file read a
 *    written `{ type: 'IMAGE', scaleMode: 'FILL', imageHash }` back with `visible` true, `opacity`
 *    1, `blendMode` NORMAL, `scalingFactor` 1, `rotation` 0, every filter at 0, the identity
 *    `imageTransform` and the same hash, and read the same after that readback was written again
 *    (P9). No probe wrote a hash the file holds no image for, so the fake throws for one.
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
 * 25. A BOOLEAN property shows or hides the layers that link their `visible` to it, as a real file
 *    showed on 2026-10-22 (PB). `addComponentProperty("Optional", "BOOLEAN", true)` on a set
 *    returned `Optional#149:3`, and a text in each of two variants linked it through
 *    `componentPropertyReferences = { visible: id }`. An instance listed it in
 *    `componentProperties` as `{ type: "BOOLEAN", value: true }`. `setProperties({ [id]: false })`
 *    hid the linked layer, which left the instance's auto layout with its 8px gap, so the hugging
 *    instance went from 102 to 24 wide. Setting true showed it again at 102. A property added
 *    with default false hid the component's own linked layer too: a hugging component of two
 *    layers and a 4px gap went from 54 to 20 wide (PQ). The probes also read the instance's
 *    `children` without the hidden layer, which the correction to PB and PQ puts down to
 *    `figma.skipInvisibleInstanceChildren`: the probe environment sets it, and a plugin that does
 *    not, as this one does not, gets the typings' default, false, where `children` lists the
 *    hidden layer and the layer reads `visible` false. The fake reads a component's linked layer
 *    at the property's default, and an instance's at the value the instance sets or else at the
 *    default. It leaves a hidden sublayer out of `children` only while the flag is set, and a run
 *    starts with it false. A hidden layer leaves only the layout rule 32 lays out, and keeps its
 *    box's size. PB set only a BOOLEAN property on an instance, and rule 34 covers the other kinds.
 *    The fake throws for a property the instance's set or component lacks. No probe wrote a layer's
 *    own `visible`, so the fake reads every other layer as visible and takes no write.
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
 * 27. `dashPattern` holds a stroke's dash and gap lengths apart from its paints. On 2026-10-22 a
 *    real file kept `[4, 4]` on a frame with a 1px SOLID stroke, kept it once the stroke's color
 *    was bound to `border` through `setBoundVariableForPaint` and written back, took `[2, 2]` with
 *    the binding kept, and cleared it with `[]` (PD). So writing `strokes` leaves the pattern, and
 *    writing the pattern leaves the paints. No probe wrote a pattern of odd length or a length that
 *    is not positive, so the fake stores any list as written, each length a 32-bit float.
 * 28. `letterSpacing` on a text. On 2026-10-23 a new text read `{ unit: "PERCENT", value: 0 }`,
 *    `{ unit: "PERCENT", value: -2.5 }` read back exactly and narrowed a hugging 18px Roboto Medium
 *    text from 122 to 116 wide, and `{ unit: "PIXELS", value: -0.45 }` read back as the 32-bit float
 *    -0.44999998807907104 (PL). The write needs the text's fonts, as every text write does (rule 7).
 *    The plugin writes one spacing for the whole layer, so the fake keeps one and never reads mixed.
 *    It does not lay out, so the spacing leaves the text's size as it was.
 * 29. A layer that fills across an auto layout that hugs that axis stretches to the length the
 *    layout's other layers set. On 2026-10-23 a hugging row held a fixed 40 × 40 frame and a 39 × 16
 *    hugging frame. FILL down the small frame read FILL and `layoutAlign` STRETCH, made it 40 tall
 *    with its text centred, and left the row hugging both ways. Resizing the square to 60 tall made
 *    the row and the filled frame 60 tall (PF). The fake reads such a layer's length as the longest
 *    of the other layers in the flow that do not fill the axis, so it follows them as they resize,
 *    and `absoluteBoundingBox` reads the same. No probe filled a layer whose siblings all fill, so
 *    there the layer keeps its own length.
 * 30. `lineHeight` in `PERCENT` on a text. On 2026-10-23 a 16px Roboto Regular text read 150% and
 *    137.5% back exactly and was 24 and 22 tall. With `fontSize` bound to `Fuse density / label-text`
 *    it was 21, 24 and 21 tall at 150% in the Dense, Comfortable and Auto modes, so the line box
 *    follows the bound size (PH). The fake keeps the percent as written, through a font size
 *    binding. It does not set text, so the line box leaves the text's size as it was.
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
 * 33. An auto layout paints a later child above an earlier one, and its first child on top when
 *    `itemReverseZIndex` is true, which reads back as written. On 2026-10-23 a vertical stack's
 *    filled panel painted over the bottom edge of a 2px ring its header held, and with the field true
 *    the ring was whole (PZ2). `paintsAbove` says which of two layers paints on top. Only a vertical
 *    stack was probed, so the fake refuses the field true on any other frame.
 * 34. `setProperties` on an instance nested in a component (N1, 2026-10-23). `componentProperties`
 *    listed `Label#<id>` TEXT, `Show icon#<id>` BOOLEAN and the variant by its bare name, VARIANT, and
 *    `setProperties` wrote a TEXT value (`Retry`), a BOOLEAN false, which hid the linked layer, and a
 *    VARIANT value (`outline`). The fake shows a TEXT value as the characters of each sublayer whose
 *    main layer links the property, and an outer instance shows the values the component set on the
 *    instance nested in it and applies the swap values among them when it swaps that instance. One
 *    projection of the values serves `componentProperties` and the swap. A VARIANT write swaps to the set's variant with the values asked for, as
 *    rule 35 does. N1 ran with the fonts loaded, so the fake requires the linked labels' fonts for a
 *    TEXT write, as rule 7 requires them for every text write. On 2026-10-24 an INSTANCE_SWAP value,
 *    a component's id, swapped the nested instance's icon to that component, `componentProperties`
 *    read the id back, and a fill override on the icon's glyph stayed (NS). So the fake swaps each
 *    sublayer whose main layer links the property's `mainComponent`, and the glyph's override moves
 *    to the new glyph of the same name, as below. It refuses a variable value, a value of the wrong
 *    type, and a variant value the set lacks.
 * 35. `swapComponent` and a VARIANT write keep the instance's node id and its TEXT and BOOLEAN values
 *    (N1), and its `componentPropertyReferences.visible`, its `isExposedInstance` and its swap
 *    property's value (NS). An override the instance itself holds stays, and a sublayer's fill
 *    override moves to the new sublayer of the same name, as below.
 * 36. A sublayer's id is `I`, the instance's id, `;` and its main layer's id (N1), and a sublayer reads
 *    the shared plugin data its main layer carries where it holds none of its own (N3), so the kit's
 *    keys find the sublayers of a nested instance.
 * 37. `overrides` lists each layer of an instance that holds an override, from the instance down, with
 *    its fields: the instance's own `name`, `width` and `height` (N1), its `fills`, `effects` and "the
 *    corner fields", and a sublayer's `fills` (N3). N3 did not name the corner fields, so the fake
 *    lists `cornerRadius` and the four corners the typings name. A property value is no override
 *    (N1). A fill written equal to the main's left no `fills` override, and `overrides` listed only
 *    the instance's `name` (NS), so a fill, stroke, effects or corner the fake stores equal to what
 *    the layer's source shows clears that override, and the field follows the source again.
 *    `removeOverrides` exists (N3), and the fake follows the typings' "removes all direct
 *    overrides": it clears what `overrides` lists and keeps the property values.
 * 38. An instance and its sublayers show their main component's fills, strokes, effects and corners,
 *    and its corner bindings, until they override them. On 2026-10-23 a padding change and a fill
 *    rebound to `destructive` on the inner variant reached the nested instance, which kept its `Retry`
 *    label (N2), and an instance's own fill bound to `success`, corner 2 and shadow, and its label's
 *    fill, all stayed when the main rebound its fill, set its corner to 10, cleared its effects and
 *    changed its label's fill (N3).
 * 39. `isExposedInstance` reads back true once written on an instance inside a component in a set,
 *    an instance of that component lists the nested instance in `exposedInstances`, and
 *    `setProperties` on the listed instance sets its TEXT (`Undo`) (N5). The typings make the field
 *    writable only on such an instance and inherited below it, so the fake refuses it elsewhere and
 *    reads an instance seen through an outer instance from its main layer alone.
 * 40. Binding the width or height of an instance that hugs that axis records the binding and keeps
 *    the hug length: on 2026-10-23 a nested instance whose height bound `row-h` kept its 26px hug
 *    height (N4). The plugin therefore writes FIXED before it binds an instance's length. A binding
 *    on any other axis resizes, as rule 5 says: on 2026-10-24 a frame that hugged its 28px height
 *    turned FIXED, in its layout sizing and its counter-axis mode, at `row-h`'s 32 (NS).
 * 41. An instance's label keeps a `textAlignHorizontal` override. On 2026-10-24 a CENTER written on
 *    the label sublayer of an instance of a component whose label was LEFT listed the sublayer with
 *    `textAlignHorizontal` in `overrides`, and the label kept CENTER and showed the new characters
 *    when the main's label turned RIGHT and took new characters. Writing the main's RIGHT on it
 *    afterwards kept the field listed, unlike a fill (NS), so an equal write leaves the override
 *    (NA). A label that overrides none shows its main layer's alignment, as rule 38 has the rest
 *    follow the main. No probe swapped an instance with the override, so a swap drops it.
 * 42. A hidden child of an auto layout reads `layoutSizingHorizontal` or `layoutSizingVertical`
 *    FIXED on an axis it fills, and keeps the fill in `layoutGrow` 1 along its parent's direction or
 *    `layoutAlign` STRETCH across it. On 2026-10-24 a hidden frame in a fixed 300-wide column read
 *    FIXED and STRETCH after a FILL across, read FILL and 300 wide once shown, and FIXED and STRETCH
 *    hidden again, and a FILL written while shown read the same once hidden. Hidden in a fixed row, a
 *    FILL along read FIXED with `layoutGrow` 1 and FILL once shown, and in a hugging row a FILL down
 *    read FIXED with STRETCH and FILL once shown (NH). The owner's file read Alert's and Empty's hidden
 *    actions that way after an Apply. The fake hides a layer only through a BOOLEAN property (rule
 *    25), and reads a hidden layer that hugs as it reads a shown one, which no probe contradicted.
 * 43. One icon instance links a BOOLEAN's `visible` and an INSTANCE_SWAP's `mainComponent` together.
 *    On 2026-10-25 an `Icon/A` instance in a hugging row, gap 8, took both links and read both back;
 *    with the BOOLEAN's default false it was hidden in the main and in an instance, and the row was
 *    59 wide. Setting it true showed the icon (83 wide), a swap through the property to `Icon/B` kept
 *    it shown with both links, and false hid it again with the swap value kept (PI2). Rules 25 and 34
 *    already read the two links apart, so the fake needs nothing more for them. The swap listed the
 *    icon's `name` in the instance's `overrides`, while the layer kept its name `icon`, a hand-set
 *    `custom` too, and a swap back to `Icon/A` still listed `name` (PI3). So a layer a property swaps
 *    keeps its name, and the fake lists `name` among its overrides from then on.
 * 44. A `minWidth` written on an instance is an override. On 2026-10-25 a fresh instance listed
 *    `minWidth` and `minHeight` on its root after a `minWidth` write alone, with `minHeight` reading
 *    null, and kept both listed after `minWidth` went back to null (PH3). The fake lists both from the
 *    first write on. It does not lay out, so the minimum clamps no size. No probe wrote another limit
 *    on an instance, so the fake lists none for those.
 * 45. TEXT values set through exposure two levels down. On 2026-10-25 a `Command item` row instance
 *    listed in `exposedInstances` its exposed `kbd-group` and the two exposed caps inside it, and the
 *    group's own `exposedInstances` listed the caps. `setProperties` on each cap set its TEXT, and the
 *    row's `overrides` listed `componentProperties` on both caps. The values stayed through the row's
 *    own TEXT write, a switch of the row's variant and edits of all three mains, and the switch gave
 *    the caps new ids, the old ones no longer existing (PN). So the fake lists the exposed instances
 *    below an exposed one too, marks `componentProperties` on a sublayer that sets properties, and
 *    carries each such sublayer's values to the new sublayer at the same names when its instance
 *    swaps. With both caps named `kbd`, each value stayed with the cap in the same place among the
 *    caps of that name, through a switch and back, and a value set on the second cap alone stayed on
 *    the second (PN2), so the fake matches each layer by its name and that place.
 *
 * An instance's sublayers show the layers of its main component, and a nested instance's sublayers
 * the sublayers its main layer shows. An override, such as the color an icon layer gives its glyph,
 * belongs to the main layer it was made on. It moves to the layer of the same name when the
 * instance swaps, as Figma's help describes and the plugin relies on, and it is lost when the main
 * component replaces that layer, which is the fake's reading of how Figma ties overrides to layers.
 *
 * It also models what the plugin typings document for a plugin with
 * `"documentAccess": "dynamic-page"`, as the components plugin declares: a page other than the
 * current one needs `loadAsync` before its children are read or changed, and an instance's
 * `mainComponent` cannot be read. `insertChild` refuses an index past the end. `layoutWrap` needs
 * an auto layout frame. A layer links only a property of the component or set it sits in, of the
 * type the link needs. A component set holds only components. A removed node throws on every
 * read but its id. A page's `remove` refuses the current page and the file's last page, as the
 * Figma editor does. The typings say nothing about either, so the plugin shows another page
 * before it removes one. On a real file on 2026-10-22, `remove` on the current page threw
 * `Removing this node is not allowed`, and removed the page once another page showed.
 *
 * The fake does not lay out: an auto layout frame keeps the size it was given, so a hugging
 * frame does not grow with its content, apart from the frames rule 32 sizes from their children
 * as they stand. Nor does it set text: a text keeps the size it was given,
 * so a wrapped, filling or truncated text's height is not modelled. It draws nothing either: a
 * layer's render bounds are its box, and a PNG export holds bytes that name the layer and the
 * scale.
 */

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";

import type { CollectionSpec, VariableValue as SyncedValue } from "../../src/variable-set.ts";
import { sha1Hex } from "./sha1.ts";

/** What a test sets up the fake file with. */
export type FakeFigmaOptions = {
  /** The collections the token sync writes, such as `fuseVariableSet()` builds them. */
  readonly collections: readonly CollectionSpec[];
  /** Fonts this machine cannot load. A font without a style marks every style of its family. */
  readonly unavailableFonts?: readonly FontNameInput[];
};

/** A fake file and what a test reads from it beside the Plugin API. */
export type FakeFigma = {
  /** The Plugin API over the file. */
  readonly figma: PluginAPI;
  /** Every write the file took, in order, such as `12:3 fills`. */
  readonly writes: readonly string[];
  /**
   * Start a new plugin run: every page but the current one needs `loadAsync` again, and so does
   * every font, and `skipInvisibleInstanceChildren` is false again. A run on another machine can
   * lack fonts the file holds.
   */
  readonly reopen: (options?: { readonly unavailableFonts?: readonly FontNameInput[] }) => void;
  /**
   * A synced variable by its collection and name.
   *
   * @throws When the file holds no such variable.
   */
  readonly variable: (collection: string, name: string) => Variable;
};

type NodeType =
  | "DOCUMENT"
  | "PAGE"
  | "FRAME"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE"
  | "TEXT"
  | "VECTOR";

/** The node a plugin sees for a node the fake holds. */
type Exposed = DocumentNode | PageNode | SceneNode;

type BindableField = VariableBindableNodeField | VariableBindableTextField;

/** The four sides of a stroke or of padding. */
type Sides = { top: number; right: number; bottom: number; left: number };

/** The four corner radii. */
type Corners = { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };

/** The lengths an auto layout frame or child keeps its size within. */
type LimitField = "minWidth" | "maxWidth" | "minHeight" | "maxHeight";

/**
 * The font, size and line height of one character of a text layer, and the variables its text
 * fields bind, by id.
 */
type CharacterStyle = {
  readonly font: FontName;
  readonly fontSize: number;
  readonly lineHeight: LineHeight;
  readonly bindings: ReadonlyMap<VariableBindableTextField, string>;
};

/** A TEXT, BOOLEAN or INSTANCE_SWAP property of a component set or a component. */
type PropertyState = {
  readonly type: "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  readonly defaultValue: string | boolean;
  readonly preferredValues: readonly InstanceSwapPreferredValue[] | undefined;
};

/** A literal a variable resolves to. */
type Literal =
  | { readonly kind: "color"; readonly color: RGBA }
  | { readonly kind: "float"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean };

/** A variable's value in one mode: a literal, or an alias of another variable by id. */
type StoredValue = Literal | { readonly kind: "alias"; readonly id: string };

type CollectionState = {
  readonly id: string;
  readonly name: string;
  readonly modes: readonly { readonly modeId: string; readonly name: string }[];
  readonly defaultModeId: string;
  readonly variableIds: string[];
  exposed: VariableCollection | undefined;
};

type VariableState = {
  readonly id: string;
  readonly name: string;
  readonly collection: CollectionState;
  readonly resolvedType: VariableResolvedDataType;
  readonly values: ReadonlyMap<string, StoredValue>;
  exposed: Variable | undefined;
};

type FileState = {
  nextNode: number;
  nextProperty: number;
  readonly writes: string[];
  readonly nodes: Map<string, NodeState>;
  document: NodeState | undefined;
  current: NodeState | undefined;
  readonly loadedFonts: Set<string>;
  unavailableFonts: readonly FontNameInput[];
  readonly collections: readonly CollectionState[];
  readonly variables: ReadonlyMap<string, VariableState>;
  /** The hash of each image the file stores (rule 22). */
  readonly images: Set<string>;
  /**
   * Whether `children` leaves out the hidden layers inside instances, as the plugin can ask with
   * `figma.skipInvisibleInstanceChildren` (rule 25). Each run starts with false.
   */
  skipInvisibleInstanceChildren: boolean;
};

/**
 * Everything the fake holds for a node, whatever its type. The guard decides which of these a
 * plugin can reach through the node's type.
 */
type NodeState = {
  readonly file: FileState;
  readonly id: string;
  readonly type: NodeType;
  readonly exposed: Exposed;
  name: string;
  parent: NodeState | undefined;
  children: NodeState[];
  removed: boolean;
  readonly sharedData: Map<string, string>;
  /** Whether a page's contents are loaded. */
  loaded: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The layer's rotation in degrees, counterclockwise, from -180 to 180 (rule 26). */
  rotation: number;
  opacity: number;
  constraints: Constraints;
  fills: readonly Paint[];
  strokes: readonly Paint[];
  strokeWeights: Sides;
  strokeAlign: FrameNode["strokeAlign"];
  strokesIncludedInLayout: boolean;
  /** The stroke's dash and gap lengths, apart from its paints, empty for a solid stroke (rule 27). */
  dashPattern: readonly number[];
  effects: readonly Effect[];
  radii: Corners;
  clipsContent: boolean;
  /** Whether the auto layout paints its first child on top (rule 33). */
  itemReverseZIndex: boolean;
  layoutMode: FrameNode["layoutMode"];
  layoutWrap: FrameNode["layoutWrap"];
  primaryAxisSizingMode: FrameNode["primaryAxisSizingMode"];
  counterAxisSizingMode: FrameNode["counterAxisSizingMode"];
  primaryAxisAlignItems: FrameNode["primaryAxisAlignItems"];
  counterAxisAlignItems: FrameNode["counterAxisAlignItems"];
  padding: Sides;
  itemSpacing: number;
  counterAxisSpacing: number | null;
  /** The node's limits, each null where none applies (rule 16). */
  limits: Record<LimitField, number | null>;
  /**
   * Whether the node grows along its auto layout parent's direction, 0 or 1. The fake hides it
   * and `layoutAlign` behind the `layoutSizing*` shorthand (rule 12).
   */
  layoutGrow: number;
  /** Whether the node stretches across its auto layout parent's direction. */
  layoutAlign: "INHERIT" | "STRETCH";
  /** Whether the node sits in its auto layout parent's flow, or outside it at its own place (rule 24). */
  layoutPositioning: FrameNode["layoutPositioning"];
  /** The variable each bound field that is not a text field follows, by id. */
  readonly bindings: Map<VariableBindableNodeField, string>;
  /** The mode the node pins for each collection, by collection id. */
  readonly explicitModes: Map<string, string>;
  propertyReferences: FrameNode["componentPropertyReferences"];
  /** The TEXT, BOOLEAN and INSTANCE_SWAP properties of a set or a component, by property id. */
  readonly properties: Map<string, PropertyState>;
  /** The values each variant property of a set lists, in the set's own order (rule 4). */
  readonly variantOrder: Map<string, string[]>;
  /** The main component of an instance. */
  main: NodeState | undefined;
  /**
   * The property values an instance sets, by property id: a BOOLEAN's flag (rule 25), a TEXT's
   * characters and an INSTANCE_SWAP's component id (rule 34).
   */
  readonly propertyValues: Map<string, string | boolean>;
  /** Whether an instance inside a component in a set is exposed to the instances around it (rule 39). */
  exposedInstance: boolean;
  /** The layer of the main component that an instance's sublayer shows. */
  mirrorOf: NodeState | undefined;
  /**
   * The fields a designer or the plugin overrode on an instance or its sublayer (rules 37 and 38), by
   * the name of the state field they cover, `size` for the width and height, and `mainComponent` for a
   * nested instance swapped apart from its main layer.
   */
  readonly overridden: Set<string>;
  characters: string;
  /** The style of each character, or of the one a text layer without characters types in. */
  styles: readonly CharacterStyle[];
  textDecoration: TextDecoration;
  /** The text's letter spacing, one for the whole layer (rule 28). */
  letterSpacing: LetterSpacing;
  textDecorationOffset: TextDecorationOffset | null;
  textAutoResize: TextNode["textAutoResize"];
  textAlignHorizontal: TextNode["textAlignHorizontal"];
  textAlignVertical: TextNode["textAlignVertical"];
  /** Whether a text ends in an ellipsis where it overflows (rule 20). */
  textTruncation: TextNode["textTruncation"];
  /** The lines a truncating text keeps, or null for all of them (rule 20). */
  maxLines: number | null;
  autoRename: boolean;
};

const STATES = new WeakMap<NodeHandle, NodeState>();

const SHARED_DATA_SEPARATOR = "\u0000";

/** Members test runners and promises probe on any object, which the guard answers with nothing. */
const INTROSPECTION = new Set<string>([
  "then",
  "toJSON",
  "asymmetricMatch",
  "$$typeof",
  "nodeType",
  "tagName",
  "@@__IMMUTABLE_ITERABLE__@@",
  "@@__IMMUTABLE_RECORD__@@",
  "_isMockFunction",
]);

function isIntrospection(property: string | symbol): boolean {
  return INTROSPECTION.has(String(property)) || String(property).startsWith("Symbol(");
}

/**
 * Wrap an object so that reading or writing a member it does not define throws.
 *
 * @param target - The object that models the API.
 * @param kind - What the object stands for, for the error.
 * @returns The guarded object.
 */
function guard<Target extends object>(target: Target, kind: string): Target {
  return new Proxy(target, {
    get: (object, property) => {
      if (property in object) {
        // SAFETY: the `in` check found the member on the object or its prototype chain.
        return object[property as keyof Target];
      }
      if (isIntrospection(property)) {
        return undefined;
      }
      throw new Error(`The fake Figma file does not model ${kind}.${String(property)}.`);
    },
    set: (object, property, value) => {
      if (!(property in object)) {
        throw new Error(`The fake Figma file does not model writing ${kind}.${String(property)}.`);
      }
      if (!Reflect.set(object, property, value)) {
        throw new Error(`${kind}.${String(property)} is read-only.`);
      }
      return true;
    },
  });
}

const f32 = Math.fround;

// SAFETY: `figma.mixed` is a symbol the plugin compares by identity, and this file makes one.
const MIXED: PluginAPI["mixed"] = Symbol("figma.mixed") as PluginAPI["mixed"];

/** A node a plugin holds, or the object behind it. */
type NodeHandle = BaseNode | FakeBaseNode;

function stateOf(node: NodeHandle): NodeState {
  const state = STATES.get(node);
  if (state === undefined) {
    throw new Error("The fake Figma file was handed a node it did not make.");
  }
  return state;
}

/** The node's state, refusing a node that was removed, as Figma does. */
function live(node: NodeHandle): NodeState {
  const state = stateOf(node);
  if (state.removed) {
    throw new Error(`The node with id ${state.id} does not exist: it was removed.`);
  }
  return state;
}

function write(state: NodeState, what: string): void {
  state.file.writes.push(`${state.id} ${what}`);
}

function sceneOf(state: NodeState): SceneNode {
  const node = state.exposed;
  if (node.type === "DOCUMENT" || node.type === "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a layer.`);
  }
  return node;
}

function pageOf(state: NodeState): PageNode {
  const node = state.exposed;
  if (node.type !== "PAGE") {
    throw new Error(`${state.id} is a ${node.type}, not a page.`);
  }
  return node;
}

function componentOf(state: NodeState): ComponentNode {
  const node = state.exposed;
  if (node.type !== "COMPONENT") {
    throw new Error(`${state.id} is a ${node.type}, not a component.`);
  }
  return node;
}

function isFrameLike(state: NodeState): boolean {
  return (
    state.type === "FRAME" ||
    state.type === "COMPONENT" ||
    state.type === "COMPONENT_SET" ||
    state.type === "INSTANCE"
  );
}

function isAutoLayout(state: NodeState | undefined): boolean {
  return state !== undefined && isFrameLike(state) && state.layoutMode !== "NONE";
}

/** A component's key, which Figma derives from the node and keeps across edits. */
function componentKey(state: NodeState): string {
  let hash = 0x811c9dc5;
  for (const character of state.id) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, "0")}${state.id.replaceAll(":", "")}`;
}

function fontKey(font: FontNameInput): string {
  return `${font.family}${SHARED_DATA_SEPARATOR}${font.style ?? ""}`;
}

function fontLoaded(file: FileState, font: FontName): boolean {
  return file.loadedFonts.has(fontKey(font)) || file.loadedFonts.has(fontKey({ family: font.family }));
}

function requireFont(state: NodeState, font: FontName, what: string): void {
  if (!fontLoaded(state.file, font)) {
    throw new Error(
      `Cannot write ${what} of ${state.id} with unloaded font "${font.family} ${font.style}". Please call figma.loadFontAsync({ family: "${font.family}", style: "${font.style}" }) and await the returned promise first.`
    );
  }
}

/** The children a node shows, an instance's sublayers included. */
function childrenOf(state: NodeState): NodeState[] {
  if (state.type === "PAGE" && !state.loaded) {
    throw new Error(
      `The page ${state.name} is not loaded. Under "documentAccess": "dynamic-page", call page.loadAsync() before reading its children.`
    );
  }
  const source = sourceOf(state);
  if (source !== undefined) {
    mirror(state, source, false);
  }
  return state.children;
}

/**
 * The layer an instance or a sublayer shows, its children and every field it does not override
 * (rule 38): an instance's main component, a sublayer's main layer, or the component a nested
 * instance was swapped to.
 */
function sourceOf(state: NodeState): NodeState | undefined {
  const own = state.mirrorOf === undefined || state.overridden.has("mainComponent");
  return state.type === "INSTANCE" && own ? state.main : state.mirrorOf;
}

/** The fields an instance or a sublayer shows from its source until it overrides them (rule 38). */
type ShownField = "fills" | "strokes" | "effects" | "radii";

/** A field as a layer shows it: its own where it overrides it or has no source, else its source's (rule 38). */
function shown<Field extends ShownField>(state: NodeState, field: Field): NodeState[Field] {
  const source = sourceOf(state);
  return source === undefined || state.overridden.has(field) ? state[field] : shown(source, field);
}

/** Note an override of a field on an instance or a sublayer (rule 37); any other layer has none. */
function markOverride(state: NodeState, field: string): void {
  if (sourceOf(state) !== undefined) {
    state.overridden.add(field);
  }
}

/**
 * Note a write of a field an instance or a sublayer shows from its source (rule 37): an override,
 * or none where the layer now holds what its source shows. On 2026-10-24 a fill written equal to the
 * main's left no `fills` override, and the field followed the main again (NS).
 */
function noteOverride(state: NodeState, field: ShownField): void {
  const source = sourceOf(state);
  if (source === undefined) {
    return;
  }
  const shownBySource: Pick<NodeState, ShownField> = {
    fills: shown(source, "fills"),
    strokes: shown(source, "strokes"),
    effects: shown(source, "effects"),
    radii: shown(source, "radii"),
  };
  if (fieldKey(field, state, state.bindings) === fieldKey(field, shownBySource, shownBindings(source))) {
    state.overridden.delete(field);
  } else {
    state.overridden.add(field);
  }
}

/** A plain value a key holds. */
type KeyPart = string | number | boolean | null;

/**
 * A layer's paints, effects or corners for a field, as text that two layers holding the same ones
 * share, whatever order their objects list their fields in.
 */
function fieldKey(
  field: ShownField,
  layer: Pick<NodeState, ShownField>,
  bindings: ReadonlyMap<VariableBindableNodeField, string>
): string {
  switch (field) {
    case "fills":
    case "strokes":
      return JSON.stringify(layer[field].map(paintKey));
    case "effects":
      return JSON.stringify(layer.effects.map(effectKey));
    case "radii": {
      const { topLeft, topRight, bottomRight, bottomLeft } = layer.radii;
      const corners = [...CORNERS].map((corner) => bindings.get(corner) ?? null);
      return JSON.stringify([topLeft, topRight, bottomRight, bottomLeft, ...corners]);
    }
  }
}

/** A stored paint's fields in a fixed order. */
function paintKey(paint: Paint): readonly KeyPart[] {
  const shared = [paint.type, paint.visible ?? true, paint.blendMode ?? "NORMAL", paint.opacity ?? 1];
  switch (paint.type) {
    case "SOLID":
      return [
        ...shared,
        paint.color.r,
        paint.color.g,
        paint.color.b,
        paint.boundVariables?.color?.id ?? null,
      ];
    case "IMAGE":
      return [...shared, paint.imageHash, paint.scaleMode];
    default:
      return shared;
  }
}

/** A stored effect's fields in a fixed order. */
function effectKey(effect: Effect): readonly KeyPart[] {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return [effect.type, effect.visible];
  }
  const bound = [...EFFECT_FIELD_TYPES.keys()].map((name) => effect.boundVariables?.[name]?.id ?? null);
  const { r, g, b, a } = effect.color;
  return [
    effect.type,
    effect.visible,
    effect.blendMode,
    r,
    g,
    b,
    a,
    effect.offset.x,
    effect.offset.y,
    effect.radius,
    effect.spread ?? 0,
    ...bound,
  ];
}

/** The main component's layer a sublayer shows, through every instance between them. */
function rootMain(state: NodeState): NodeState {
  let main = state;
  while (main.mirrorOf !== undefined) {
    main = main.mirrorOf;
  }
  return main;
}

/** The nearest instance around a layer, which sets the properties its main layer links. */
function nearestInstance(state: NodeState): NodeState | undefined {
  let current = state.parent;
  while (current !== undefined && current.type !== "INSTANCE") {
    current = current.parent;
  }
  return current;
}

/**
 * The value an instance sets for a property, or the one the instance it shows through sets, as an
 * outer instance shows the values a component set on the instance nested in it.
 */
function propertyValue(state: NodeState, id: string): string | boolean | undefined {
  return (
    state.propertyValues.get(id) ??
    (state.mirrorOf === undefined ? undefined : propertyValue(state.mirrorOf, id))
  );
}

/**
 * Give an instance, or a sublayer of one, a sublayer for each child of the layer it shows. A
 * sublayer stays while its main layer does. A swap also carries the overrides of a sublayer to
 * the new sublayer of the same name, as Figma keeps a glyph's color when an icon swaps.
 */
function mirror(state: NodeState, source: NodeState, swapped: boolean): void {
  const shown = childrenOf(source);
  if (
    !swapped &&
    shown.length === state.children.length &&
    shown.every((child, index) => state.children[index]?.mirrorOf === child)
  ) {
    return;
  }
  const previous = state.children;
  state.children = shown.map((child) => {
    const kept = swapped ? undefined : previous.find((sublayer) => sublayer.mirrorOf === child);
    if (kept !== undefined) {
      return kept;
    }
    const sublayer = copyNode(state.file, child, child.type, `I${state.id};${child.id}`);
    sublayer.mirrorOf = child;
    sublayer.parent = state;
    const named = swapped ? previous.find((old) => old.name === child.name) : undefined;
    if (named?.overridden.has("fills") === true) {
      sublayer.fills = named.fills;
      sublayer.overridden.add("fills");
    }
    return sublayer;
  });
  for (const old of previous) {
    if (!state.children.includes(old)) {
      markRemoved(old);
    }
  }
}

function markRemoved(state: NodeState): void {
  state.removed = true;
  for (const child of state.children) {
    markRemoved(child);
  }
}

function detach(state: NodeState): void {
  const parent = state.parent;
  if (parent === undefined) {
    return;
  }
  parent.children = parent.children.filter((child) => child !== state);
  state.parent = undefined;
}

function isAncestor(candidate: NodeState, of: NodeState): boolean {
  for (let current: NodeState | undefined = of; current !== undefined; current = current.parent) {
    if (current === candidate) {
      return true;
    }
  }
  return false;
}

/** Move `child` into `parent` at `index`, or at the end. */
function insert(parent: NodeState, child: NodeState, index: number | undefined): void {
  childrenOf(parent);
  if (parent.type === "INSTANCE" || parent.mirrorOf !== undefined) {
    throw new Error(`Cannot move a layer into the instance ${parent.id}.`);
  }
  if (child.mirrorOf !== undefined) {
    throw new Error(`Cannot move ${child.id}, a layer inside an instance.`);
  }
  if (parent.type === "COMPONENT_SET" && child.type !== "COMPONENT") {
    throw new Error(`A component set holds only components, and ${child.id} is a ${child.type}.`);
  }
  if (isAncestor(child, parent)) {
    throw new Error(`Cannot move ${child.id} into itself.`);
  }
  if (index !== undefined && (index < 0 || index > parent.children.length)) {
    throw new Error(`Cannot insert at index ${index}: ${parent.id} holds ${parent.children.length} layers.`);
  }
  detach(child);
  const at = index === undefined ? parent.children.length : Math.min(index, parent.children.length);
  parent.children.splice(at, 0, child);
  child.parent = parent;
  write(parent, `insert ${child.id} at ${at}`);
}

/** The mode a node reads a collection in: the nearest pinned one, or the default. */
function modeFor(consumer: NodeState | undefined, collection: CollectionState): string {
  for (let current = consumer; current !== undefined; current = current.parent) {
    const pinned = current.explicitModes.get(collection.id);
    if (pinned !== undefined) {
      return pinned;
    }
  }
  return collection.defaultModeId;
}

function variableState(file: FileState, id: string): VariableState {
  const variable = file.variables.get(id);
  if (variable === undefined) {
    throw new Error(`The file holds no variable with the id ${id}.`);
  }
  return variable;
}

/** The literal a variable takes in a node, or in the default modes without a node. */
function resolve(file: FileState, variable: VariableState, consumer: NodeState | undefined): Literal {
  const seen = new Set<string>();
  let current = variable;
  for (;;) {
    if (seen.has(current.id)) {
      throw new Error(`${variable.name} aliases itself.`);
    }
    seen.add(current.id);
    const value = current.values.get(modeFor(consumer, current.collection));
    if (value === undefined) {
      throw new Error(`${current.name} has no value in the mode ${variable.name} reads.`);
    }
    if (value.kind !== "alias") {
      return value;
    }
    current = variableState(file, value.id);
  }
}

function resolveColor(file: FileState, variable: VariableState, consumer: NodeState | undefined): RGBA {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "color") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a color.`);
  }
  return value.color;
}

function resolveNumber(file: FileState, variable: VariableState, consumer: NodeState | undefined): number {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "float") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a number.`);
  }
  return value.value;
}

function resolveString(file: FileState, variable: VariableState, consumer: NodeState | undefined): string {
  const value = resolve(file, variable, consumer);
  if (value.kind !== "string") {
    throw new Error(`${variable.name} resolves to a ${value.kind}, not a string.`);
  }
  return value.value;
}

function figmaValue(value: StoredValue): VariableValue {
  switch (value.kind) {
    case "alias":
      return { type: "VARIABLE_ALIAS", id: value.id };
    case "color":
      return value.color;
    case "float":
    case "string":
    case "boolean":
      return value.value;
  }
}

function alias(id: string): VariableAlias {
  return { type: "VARIABLE_ALIAS", id };
}

/** The variable a plugin hands the fake, which must be one the file holds. */
function fileVariable(file: FileState, variable: Variable): VariableState {
  return variableState(file, variable.id);
}

function requireType(variable: VariableState, type: VariableResolvedDataType, field: string): void {
  if (variable.resolvedType !== type) {
    throw new Error(
      `Cannot bind the ${variable.resolvedType} variable ${variable.name} to ${field}, which takes a ${type}.`
    );
  }
}

/** The filters of an image paint, each at the 0 a real file read back where none was written (rule 23). */
const NO_IMAGE_FILTERS: Required<ImageFilters> = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
};

/**
 * A paint as Figma stores it: 32-bit channels and the documented defaults filled in, and an image
 * paint with the defaults a real file read back (rule 23).
 */
function storePaint(file: FileState, paint: Paint): Paint {
  if (paint.type === "IMAGE") {
    if (paint.imageHash === null || !file.images.has(paint.imageHash)) {
      throw new Error(
        `The fake Figma file holds no image ${String(paint.imageHash)}, and does not model a paint of an image it lacks.`
      );
    }
    return {
      visible: true,
      blendMode: "NORMAL",
      scalingFactor: 1,
      rotation: 0,
      imageTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      ...paint,
      opacity: f32(paint.opacity ?? 1),
      filters: { ...NO_IMAGE_FILTERS, ...paint.filters },
    };
  }
  if (paint.type !== "SOLID") {
    return paint;
  }
  return {
    ...paint,
    color: { r: f32(paint.color.r), g: f32(paint.color.g), b: f32(paint.color.b) },
    opacity: f32(paint.opacity ?? 1),
    visible: paint.visible ?? true,
    blendMode: paint.blendMode ?? "NORMAL",
  };
}

function storeRgba(color: RGBA): RGBA {
  return { r: f32(color.r), g: f32(color.g), b: f32(color.b), a: f32(color.a) };
}

/** The variable ids an effect list binds to shadow colors. */
function heldColorBindings(effects: readonly Effect[]): ReadonlySet<string> {
  return new Set(
    effects.flatMap((effect) =>
      (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") &&
      effect.boundVariables?.color !== undefined
        ? [effect.boundVariables.color.id]
        : []
    )
  );
}

/** An effect as the node stores it under rule 2. */
function storeEffect(state: NodeState, effect: Effect, held: ReadonlySet<string>): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return effect;
  }
  const bound = effect.boundVariables?.color?.id;
  const color =
    bound === undefined || held.has(bound)
      ? effect.color
      : resolveColor(state.file, variableState(state.file, bound), state);
  return {
    ...effect,
    color: storeRgba(color),
    offset: { x: f32(effect.offset.x), y: f32(effect.offset.y) },
    radius: f32(effect.radius),
    spread: f32(effect.spread ?? 0),
  };
}

/**
 * Resize a node, turn an auto layout frame's sizing modes to FIXED (rule 5), and stop it filling
 * its auto layout parent (rule 14). A text whose height follows its lines keeps it (rule 19), and a
 * 0-wide one that fills across keeps the fill, which the width lets take over (rule 31).
 */
function resize(state: NodeState, width: number, height: number): void {
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
function measuredWidth(characters: string, fontSize: number): number {
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
    default:
      throw new Error(`The fake Figma file does not model ${constraint} constraints.`);
  }
}

/**
 * Resize a node and move and resize each child as its constraints say (rule 9). An auto layout
 * frame places its children in its flow by its layout instead, which the fake does not model, and
 * moves and resizes only its absolute children by their constraints (rule 24).
 */
function resizeWithConstraints(state: NodeState, width: number, height: number): void {
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
 * Note that an instance holds a width and a height of its own, which its main component's resize
 * leaves (rule 32), until a HUG on an axis lets that axis follow its content again.
 */
function ownSize(state: NodeState): void {
  if (state.type === "INSTANCE") {
    state.overridden.add("width");
    state.overridden.add("height");
  }
}

/** The override that holds an instance's own length on an axis (rule 32). */
function lengthOverride(axis: Axis): "width" | "height" {
  return axis === "HORIZONTAL" ? "width" : "height";
}

function rescale(state: NodeState, scale: number): void {
  ownSize(state);
  state.x = f32(state.x * scale);
  state.y = f32(state.y * scale);
  state.width = f32(state.width * scale);
  state.height = f32(state.height * scale);
  for (const child of state.children) {
    rescale(child, scale);
  }
}

/** An axis of a layer, named as `layoutMode` names the direction along it. */
type Axis = "HORIZONTAL" | "VERTICAL";

type Sizing = FrameNode["layoutSizingHorizontal"];

/** The sizing mode of an auto layout frame that covers an axis: the primary one along its direction. */
function modeOn(state: NodeState, axis: Axis): "primaryAxisSizingMode" | "counterAxisSizingMode" {
  return state.layoutMode === axis ? "primaryAxisSizingMode" : "counterAxisSizingMode";
}

/** Whether a node sets its own place: it sits outside any auto layout's flow, or absolute in one (rule 24). */
function placesItself(state: NodeState): boolean {
  return !isAutoLayout(state.parent) || state.layoutPositioning === "ABSOLUTE";
}

/** Whether a node fills an axis of its auto layout parent: it grows along its direction, or stretches across it. */
function fills(state: NodeState, axis: Axis): boolean {
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
 * any other node reads as it stands.
 *
 * @returns The node.
 */
function settled(state: NodeState): NodeState {
  const source = sourceOf(state);
  if (state.type !== "INSTANCE" || source === undefined) {
    return state;
  }
  if (!state.overridden.has(lengthOverride("HORIZONTAL"))) {
    state.width = lengthOn(source, "HORIZONTAL");
  }
  if (!state.overridden.has(lengthOverride("VERTICAL"))) {
    state.height = lengthOn(source, "VERTICAL");
  }
  return state;
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
 * layout, as it did on a real file (PB), and so does an absolute one (rule 24).
 */
function huggedLength(state: NodeState, axis: Axis): number {
  const flow = childrenOf(state).filter(
    (child) => child.layoutPositioning !== "ABSOLUTE" && !hiddenByProperty(child)
  );
  const padding =
    axis === "HORIZONTAL"
      ? state.padding.left + state.padding.right
      : state.padding.top + state.padding.bottom;
  if (state.layoutMode === axis) {
    const lengths = flow.reduce((sum, child) => sum + lengthOn(child, axis), 0);
    return padding + lengths + state.itemSpacing * Math.max(0, flow.length - 1);
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
  const room = state.width - state.padding.left - state.padding.right;
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
  return state.padding.top + rows.reduce((sum, row) => sum + row, 0) + between + state.padding.bottom;
}

/**
 * A node's length on an axis: the height a wrapping row that hugs it sizes to from its children
 * (rule 32), the length it stretches to across an auto layout that hugs that axis (rule 29), the
 * longest of the parent's other layers in its flow that do not fill the axis, or its own where it
 * does not stretch so or no such layer sets a length. Its own is the length it hugs around a nested
 * instance as its children stand (rule 32), or the one it was given.
 */
function lengthOn(state: NodeState, axis: Axis): number {
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
  const given = axis === "HORIZONTAL" ? state.width : state.height;
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
function sizingOn(state: NodeState, axis: Axis): Sizing {
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
function setSizing(state: NodeState, axis: Axis, value: Sizing): void {
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

function setLimit(state: NodeState, field: LimitField, value: number | null): void {
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

/** The fields a binding to `cornerRadius` or `strokeWeight` lands on, as the typings note. */
function bindingTargets(field: VariableBindableNodeField): readonly VariableBindableNodeField[] {
  switch (field) {
    case "cornerRadius":
      return ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
    case "strokeWeight":
      return ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
    default:
      return [field];
  }
}

const TEXT_FIELDS: ReadonlySet<VariableBindableTextField> = new Set<VariableBindableTextField>([
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent",
]);

function isTextField(field: BindableField): field is VariableBindableTextField {
  const names: ReadonlySet<string> = TEXT_FIELDS;
  return names.has(field);
}

/** Bind or unbind a field of a layer that is not text. */
function bindNodeField(state: NodeState, field: VariableBindableNodeField, variable: Variable | null): void {
  const targets = bindingTargets(field);
  if (variable === null) {
    for (const target of targets) {
      state.bindings.delete(target);
    }
    if (targets.some((target) => CORNERS.has(target))) {
      noteOverride(state, "radii");
    }
    write(state, `unbind ${field}`);
    return;
  }
  const bound = fileVariable(state.file, variable);
  requireType(bound, "FLOAT", field);
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

/** The fields that hold a corner's radius. */
const CORNERS: ReadonlySet<VariableBindableNodeField> = new Set(bindingTargets("cornerRadius"));

/**
 * Whether a binding leaves an instance's length as it hugs: on 2026-10-23 a real file recorded a
 * height binding on a nested instance that hugged its height and kept the hug height, 26 (N4).
 */
function keepsHug(state: NodeState, field: VariableBindableNodeField): boolean {
  const axis = field === "width" ? "HORIZONTAL" : field === "height" ? "VERTICAL" : undefined;
  return state.type === "INSTANCE" && axis !== undefined && sizingOn(state, axis) === "HUG";
}

/** The distinct fonts of some characters' styles. */
function distinctFonts(styles: readonly CharacterStyle[]): FontName[] {
  const fonts = new Map(styles.map((style) => [fontKey(style.font), style.font] as const));
  return [...fonts.values()].map((font) => ({ ...font }));
}

/** The fonts a text layer holds (rule 7). */
function heldFonts(state: NodeState): readonly FontName[] {
  return distinctFonts(state.styles);
}

function requireHeldFonts(state: NodeState, what: string): void {
  for (const font of heldFonts(state)) {
    requireFont(state, font, what);
  }
}

/** Restyle the characters from `start` to `end` (rule 10). */
function restyle(
  state: NodeState,
  start: number,
  end: number,
  update: (style: CharacterStyle) => CharacterStyle
): void {
  state.styles = state.styles.map((style, index) => (index >= start && index < end ? update(style) : style));
}

function withBinding(
  style: CharacterStyle,
  field: VariableBindableTextField,
  id: string | undefined
): ReadonlyMap<VariableBindableTextField, string> {
  const bindings = new Map(style.bindings);
  if (id === undefined) {
    bindings.delete(field);
  } else {
    bindings.set(field, id);
  }
  return bindings;
}

/**
 * The standard style name for each weight a `fontWeight` variable can bind (rule 10). The fake
 * models only these names, so a family with other style names throws.
 */
const WEIGHT_STYLES: ReadonlyMap<number, string> = new Map([
  [100, "Thin"],
  [200, "ExtraLight"],
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
  [800, "ExtraBold"],
  [900, "Black"],
]);

const WEIGHTED_STYLES: ReadonlySet<string> = new Set(WEIGHT_STYLES.values());

/** The style a font takes for a bound weight (rule 10). */
function weightedStyle(font: FontName, weight: number): string {
  const style = WEIGHT_STYLES.get(weight);
  if (style === undefined) {
    throw new Error(`The fake Figma file does not model the font weight ${weight}.`);
  }
  if (!WEIGHTED_STYLES.has(font.style)) {
    throw new Error(`The fake Figma file does not model the weight of the style "${font.style}".`);
  }
  return style;
}

/**
 * Bind or unbind a text field of the characters from `start` to `end` (rules 7 and 10). A
 * family, style or weight binding changes the font of those characters, and a size or line
 * height binding their size or line height.
 */
function bindTextRange(
  state: NodeState,
  start: number,
  end: number,
  field: VariableBindableTextField,
  variable: Variable | null
): void {
  if (variable === null) {
    restyle(state, start, end, (style) => ({ ...style, bindings: withBinding(style, field, undefined) }));
    write(state, `unbind ${field}`);
    return;
  }
  requireHeldFonts(state, field);
  const bound = fileVariable(state.file, variable);
  const update = ((): ((style: CharacterStyle) => CharacterStyle) => {
    switch (field) {
      case "fontFamily": {
        requireType(bound, "STRING", field);
        const family = resolveString(state.file, bound, state);
        return (style) => ({ ...style, font: { family, style: style.font.style } });
      }
      case "fontStyle": {
        requireType(bound, "STRING", field);
        const fontStyle = resolveString(state.file, bound, state);
        return (style) => ({ ...style, font: { family: style.font.family, style: fontStyle } });
      }
      case "fontWeight": {
        requireType(bound, "FLOAT", field);
        const weight = resolveNumber(state.file, bound, state);
        return (style) => ({
          ...style,
          font: { family: style.font.family, style: weightedStyle(style.font, weight) },
        });
      }
      case "fontSize": {
        requireType(bound, "FLOAT", field);
        const fontSize = f32(resolveNumber(state.file, bound, state));
        return (style) => ({ ...style, fontSize });
      }
      case "lineHeight": {
        requireType(bound, "FLOAT", field);
        const value = f32(resolveNumber(state.file, bound, state));
        return (style) => ({ ...style, lineHeight: { unit: "PIXELS", value } });
      }
      default:
        throw new Error(`The fake Figma file does not model binding ${field}.`);
    }
  })();
  const restyled = state.styles.slice(start, end).map(update);
  for (const font of distinctFonts(restyled)) {
    requireFont(state, font, field);
  }
  restyle(state, start, end, (style) => ({
    ...update(style),
    bindings: withBinding(style, field, bound.id),
  }));
  write(state, `bind ${field}`);
}

/**
 * Write a font to the characters from `start` to `end`, which needs only that font loaded
 * (rules 7 and 10). `label` names the write in the log.
 */
function writeFont(state: NodeState, start: number, end: number, font: FontName, label: string): void {
  requireFont(state, font, label);
  write(state, label);
  restyle(state, start, end, (style) => ({ ...style, font: { family: font.family, style: font.style } }));
}

/** The value the characters share, or `figma.mixed` when they differ (rule 10). */
function shared<T>(state: NodeState, read: (style: CharacterStyle) => T): T | PluginAPI["mixed"] {
  const values = new Map(state.styles.map((style) => [JSON.stringify(read(style)), read(style)] as const));
  const [value, ...others] = values.values();
  return value === undefined || others.length > 0 ? MIXED : value;
}

/** Bind or unbind a field of a text layer, every character's for a text field. */
function bindTextField(state: NodeState, field: BindableField, variable: Variable | null): void {
  if (!isTextField(field)) {
    if (field === "characters") {
      throw new Error("The fake Figma file does not model binding characters.");
    }
    bindNodeField(state, field, variable);
    return;
  }
  bindTextRange(state, 0, state.styles.length, field, variable);
}

/**
 * The variable each bound field follows, by id, the corners as the layer shows them: an instance or a
 * sublayer that does not override its corners shows its source's (rule 38).
 */
function shownBindings(state: NodeState): ReadonlyMap<VariableBindableNodeField, string> {
  const source = sourceOf(state);
  if (source === undefined || state.overridden.has("radii")) {
    return state.bindings;
  }
  const own = [...state.bindings].filter(([field]) => !CORNERS.has(field));
  const corners = [...shownBindings(source)].filter(([field]) => CORNERS.has(field));
  return new Map([...own, ...corners]);
}

function nodeBindings(state: NodeState): NonNullable<FrameNode["boundVariables"]> {
  const nodeFields: { [field in VariableBindableNodeField]?: VariableAlias } = {};
  for (const [field, id] of shownBindings(state)) {
    nodeFields[field] = alias(id);
  }
  const textFields: { [field in VariableBindableTextField]?: VariableAlias[] } = {};
  for (const field of TEXT_FIELDS) {
    const ids = new Set(state.styles.flatMap((style) => style.bindings.get(field) ?? []));
    if (ids.size > 0) {
      textFields[field] = [...ids].map(alias);
    }
  }
  return { ...nodeFields, ...textFields };
}

/** The variable ids a layer's fields, text, paints and effects bind. */
function layerBindings(state: NodeState): string[] {
  const paints = [...shown(state, "fills"), ...shown(state, "strokes")].flatMap((paint) =>
    paint.type === "SOLID" && paint.boundVariables?.color !== undefined ? [paint.boundVariables.color.id] : []
  );
  const effects = shown(state, "effects").flatMap((effect) =>
    effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"
      ? [...EFFECT_FIELD_TYPES.keys()].flatMap((field) => effect.boundVariables?.[field]?.id ?? [])
      : []
  );
  const text = state.styles.flatMap((style) => [...style.bindings.values()]);
  return [...state.bindings.values(), ...text, ...paints, ...effects];
}

/** The variable ids a layer and every layer under it bind, an instance's sublayers included. */
function subtreeBindings(state: NodeState): Set<string> {
  const ids = new Set(layerBindings(state));
  for (const child of childrenOf(state)) {
    for (const id of subtreeBindings(child)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * The collections a layer reads through the bindings in its subtree: each bound variable's,
 * and each alias target's, following the aliases in the modes the layer reads.
 */
function boundCollections(state: NodeState): Set<string> {
  const visited = new Set<string>();
  const collections = new Set<string>();
  for (const id of subtreeBindings(state)) {
    for (let next: string | undefined = id; next !== undefined && !visited.has(next);) {
      visited.add(next);
      const variable = variableState(state.file, next);
      collections.add(variable.collection.id);
      const value = variable.values.get(modeFor(state, variable.collection));
      next = value?.kind === "alias" ? value.id : undefined;
    }
  }
  return collections;
}

/** The node a layer's property link reads from: its component set, or its component. */
function propertyOwner(state: NodeState): NodeState | undefined {
  for (let current = state.parent; current !== undefined; current = current.parent) {
    if (current.type === "COMPONENT_SET") {
      return current;
    }
    if (current.type === "COMPONENT") {
      return current.parent?.type === "COMPONENT_SET" ? current.parent : current;
    }
  }
  return undefined;
}

const LINKED_TYPES = new Map<string, ComponentPropertyType>([
  ["characters", "TEXT"],
  ["mainComponent", "INSTANCE_SWAP"],
  ["visible", "BOOLEAN"],
]);

function linkProperties(state: NodeState, references: FrameNode["componentPropertyReferences"]): void {
  if (references === null) {
    state.propertyReferences = null;
    write(state, "componentPropertyReferences");
    return;
  }
  const owner = propertyOwner(state);
  for (const [nodeProperty, propertyId] of Object.entries(references)) {
    const type = LINKED_TYPES.get(nodeProperty);
    if (type === undefined) {
      throw new Error(`The fake Figma file does not model linking ${nodeProperty}.`);
    }
    if (owner === undefined) {
      throw new Error(`${state.id} links ${propertyId}, but it sits in no component.`);
    }
    const definition = definitions(owner)[propertyId];
    if (definition?.type !== type) {
      throw new Error(
        `${state.id} links ${nodeProperty} to ${propertyId}, which is no ${type} property of ${owner.id}.`
      );
    }
  }
  state.propertyReferences = { ...references };
  write(state, "componentPropertyReferences");
}

/** An instance's main component, and the set or component that holds the properties it shows. */
function instanceOwner(state: NodeState) {
  const main = state.main;
  if (main === undefined) {
    throw new Error(`The instance ${state.id} has no main component.`);
  }
  return { main, owner: main.parent?.type === "COMPONENT_SET" ? main.parent : main };
}

/**
 * Whether a layer is hidden through a BOOLEAN property (rule 25). A component's layer that links
 * its `visible` to a property hides while the property starts false. An instance's sublayer reads
 * the property at the value the nearest instance around it sets, or the instance it shows through,
 * or else at its default.
 */
function hiddenByProperty(state: NodeState): boolean {
  const main = rootMain(state);
  const id = main.propertyReferences?.visible;
  if (id === undefined) {
    return false;
  }
  const defaultValue = propertyOwner(main)?.properties.get(id)?.defaultValue;
  if (state.mirrorOf === undefined) {
    return defaultValue === false;
  }
  const instance = nearestInstance(state);
  return ((instance === undefined ? undefined : propertyValue(instance, id)) ?? defaultValue) === false;
}

/**
 * The characters a text shows (rule 34): a sublayer whose main layer links a TEXT property shows the
 * value the nearest instance sets, and otherwise its main layer's, until a designer overrides them.
 */
function charactersOf(state: NodeState): string {
  const source = state.mirrorOf;
  if (source === undefined || state.overridden.has("characters")) {
    return state.characters;
  }
  const id = rootMain(state).propertyReferences?.characters;
  const instance = nearestInstance(state);
  const value = id === undefined || instance === undefined ? undefined : propertyValue(instance, id);
  return value === undefined || value === true || value === false ? charactersOf(source) : value;
}

/**
 * The horizontal alignment a text shows (rule 41): a sublayer shows its main layer's until it
 * overrides it.
 */
function alignmentOf(state: NodeState): TextNode["textAlignHorizontal"] {
  const source = state.mirrorOf;
  return source === undefined || state.overridden.has("textAlignHorizontal")
    ? state.textAlignHorizontal
    : alignmentOf(source);
}

/** A variant's property values, read from its name, or undefined for a name without them. */
function variantValues(name: string): ReadonlyMap<string, string> | undefined {
  const pairs = name.split(",").map((part) => part.trim().split("="));
  if (pairs.some((pair) => pair.length !== 2)) {
    return undefined;
  }
  return new Map(pairs.map(([property = "", value = ""]) => [property.trim(), value.trim()]));
}

/** The top-left variant of a set (rule 4). */
function defaultVariant(set: NodeState): NodeState {
  const [first, ...rest] = set.children;
  if (first === undefined) {
    throw new Error(`The component set ${set.id} holds no variants.`);
  }
  return rest.reduce(
    (best, child) => (child.y < best.y || (child.y === best.y && child.x < best.x) ? child : best),
    first
  );
}

/**
 * Keep a renamed variant's value in the slot of the value it replaced, when no other variant
 * still shows that value (rule 4).
 */
function renameVariantValues(
  set: NodeState,
  variant: NodeState,
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string> | undefined
): void {
  for (const [property, old] of before) {
    const renamed = after?.get(property);
    const order = set.variantOrder.get(property);
    const shown = set.children.some(
      (child) => child !== variant && variantValues(child.name)?.get(property) === old
    );
    if (renamed === undefined || renamed === old || order === undefined || shown || order.includes(renamed)) {
      continue;
    }
    set.variantOrder.set(
      property,
      order.map((value) => (value === old ? renamed : value))
    );
  }
}

/**
 * A set's variant properties and their values in the set's own order: the values it still shows
 * keep their places, and a value it shows for the first time goes last (rule 4).
 */
function variantOptions(set: NodeState): Map<string, string[]> {
  const shown = new Map<string, string[]>();
  for (const child of set.children) {
    for (const [property, value] of variantValues(child.name) ?? []) {
      const values = shown.get(property) ?? [];
      if (!values.includes(value)) {
        values.push(value);
      }
      shown.set(property, values);
    }
  }
  for (const [property, values] of shown) {
    const kept = (set.variantOrder.get(property) ?? []).filter((value) => values.includes(value));
    set.variantOrder.set(property, [...kept, ...values.filter((value) => !kept.includes(value))]);
  }
  return new Map([...shown.keys()].map((property) => [property, set.variantOrder.get(property) ?? []]));
}

/** A set's or a component's property definitions, the variant properties first (rule 4). */
function definitions(state: NodeState): ComponentPropertyDefinitions {
  const result: ComponentPropertyDefinitions = {};
  if (state.type === "COMPONENT_SET") {
    const top = variantValues(defaultVariant(state).name);
    for (const [property, values] of variantOptions(state)) {
      result[property] = { type: "VARIANT", defaultValue: top?.get(property) ?? "", variantOptions: values };
    }
  }
  for (const [id, property] of state.properties) {
    result[id] =
      property.preferredValues === undefined
        ? { type: property.type, defaultValue: property.defaultValue }
        : {
            type: property.type,
            defaultValue: property.defaultValue,
            preferredValues: [...property.preferredValues],
          };
  }
  return result;
}

function requirePropertyHolder(state: NodeState): void {
  if (state.type === "COMPONENT" && state.parent?.type === "COMPONENT_SET") {
    throw new Error(`${state.id} is a variant. Read and change the properties of its component set instead.`);
  }
}

function componentWithId(file: FileState, id: string): NodeState {
  const found = file.nodes.get(id);
  if (found?.type !== "COMPONENT" || found.removed) {
    throw new Error(`An INSTANCE_SWAP property must start with a component, and ${id} is none.`);
  }
  return found;
}

function checkPreferred(file: FileState, preferred: readonly InstanceSwapPreferredValue[]): void {
  const keys = new Set(
    [...file.nodes.values()]
      .filter((node) => node.type === "COMPONENT" && !node.removed)
      .map((node) => componentKey(node))
  );
  for (const value of preferred) {
    if (value.type !== "COMPONENT" || !keys.has(value.key)) {
      throw new Error(`The preferred value ${value.key} is no component of the file.`);
    }
  }
}

function addProperty(
  state: NodeState,
  name: string,
  type: ComponentPropertyType,
  defaultValue: string | boolean | VariableAlias,
  options: ComponentPropertyOptions | undefined
): string {
  requirePropertyHolder(state);
  if (type !== "TEXT" && type !== "BOOLEAN" && type !== "INSTANCE_SWAP") {
    throw new Error(`The fake Figma file does not model adding a ${type} property.`);
  }
  const value = checkedDefault(state.file, type, defaultValue);
  const preferred = options?.preferredValues;
  if (preferred !== undefined) {
    checkPreferred(state.file, preferred);
  }
  state.file.nextProperty += 1;
  const id = `${name}#${state.file.nextProperty}:0`;
  state.properties.set(id, {
    type,
    defaultValue: value,
    preferredValues: preferred === undefined ? undefined : [...preferred],
  });
  write(state, `add the property ${id}`);
  return id;
}

function isText(value: string | VariableAlias): value is string {
  return !(value instanceof Object);
}

function checkedDefault(
  file: FileState,
  type: PropertyState["type"],
  value: string | boolean | VariableAlias
): string | boolean {
  if (value === true || value === false) {
    if (type !== "BOOLEAN") {
      throw new Error(`A ${type} property cannot start with a boolean.`);
    }
    return value;
  }
  if (isText(value)) {
    if (type === "INSTANCE_SWAP") {
      componentWithId(file, value);
    } else if (type === "BOOLEAN") {
      throw new Error("A BOOLEAN property must start with a boolean.");
    }
    return value;
  }
  throw new Error("The fake Figma file does not model a property that starts with a variable.");
}

function editProperty(
  state: NodeState,
  id: string,
  edit: Parameters<ComponentSetNode["editComponentProperty"]>[1]
): string {
  requirePropertyHolder(state);
  const property = state.properties.get(id);
  if (property === undefined) {
    throw new Error(`${state.id} has no property ${id} to edit.`);
  }
  if (edit.description !== undefined || edit.slotSettings !== undefined) {
    throw new Error("The fake Figma file does not model slot properties.");
  }
  const preferred = edit.preferredValues;
  if (preferred !== undefined) {
    if (property.type !== "INSTANCE_SWAP") {
      throw new Error(
        `Only an INSTANCE_SWAP property takes preferred values, and ${id} is a ${property.type}.`
      );
    }
    checkPreferred(state.file, preferred);
  }
  const edited: PropertyState = {
    type: property.type,
    defaultValue:
      edit.defaultValue === undefined
        ? property.defaultValue
        : checkedDefault(state.file, property.type, edit.defaultValue),
    preferredValues: preferred === undefined ? property.preferredValues : [...preferred],
  };
  const renamed = edit.name === undefined ? id : `${edit.name}#${id.split("#")[1] ?? ""}`;
  state.properties.delete(id);
  state.properties.set(renamed, edited);
  write(state, `edit the property ${id}`);
  return renamed;
}

/**
 * The fields of a node a copy does not take from its source: its identity, its place in the
 * tree, and what a duplicate or an instance's sublayer gets otherwise or not at all.
 */
type UncopiedField =
  | "file"
  | "id"
  | "type"
  | "exposed"
  | "parent"
  | "children"
  | "removed"
  | "sharedData"
  | "loaded"
  | "mirrorOf"
  | "overridden"
  | "properties"
  | "propertyValues"
  | "exposedInstance"
  | "variantOrder";

/**
 * The fields a copy takes from its source, with every object cloned. The return type names
 * every field of `NodeState` but the uncopied ones, so a new field fails the type check until
 * it is copied here or listed as uncopied.
 */
function copiedFields(source: NodeState): Omit<NodeState, UncopiedField> {
  return {
    name: source.name,
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
    rotation: source.rotation,
    opacity: source.opacity,
    constraints: { ...source.constraints },
    fills: source.fills,
    strokes: source.strokes,
    strokeWeights: { ...source.strokeWeights },
    strokeAlign: source.strokeAlign,
    strokesIncludedInLayout: source.strokesIncludedInLayout,
    dashPattern: source.dashPattern,
    effects: source.effects,
    radii: { ...source.radii },
    clipsContent: source.clipsContent,
    itemReverseZIndex: source.itemReverseZIndex,
    layoutMode: source.layoutMode,
    layoutWrap: source.layoutWrap,
    primaryAxisSizingMode: source.primaryAxisSizingMode,
    counterAxisSizingMode: source.counterAxisSizingMode,
    primaryAxisAlignItems: source.primaryAxisAlignItems,
    counterAxisAlignItems: source.counterAxisAlignItems,
    padding: { ...source.padding },
    itemSpacing: source.itemSpacing,
    counterAxisSpacing: source.counterAxisSpacing,
    limits: { ...source.limits },
    layoutGrow: source.layoutGrow,
    layoutAlign: source.layoutAlign,
    layoutPositioning: source.layoutPositioning,
    bindings: new Map(source.bindings),
    explicitModes: new Map(source.explicitModes),
    propertyReferences: source.propertyReferences === null ? null : { ...source.propertyReferences },
    main: source.main,
    characters: source.characters,
    styles: source.styles,
    textDecoration: source.textDecoration,
    letterSpacing: { ...source.letterSpacing },
    textDecorationOffset: source.textDecorationOffset === null ? null : { ...source.textDecorationOffset },
    textAutoResize: source.textAutoResize,
    textAlignHorizontal: source.textAlignHorizontal,
    textAlignVertical: source.textAlignVertical,
    textTruncation: source.textTruncation,
    maxLines: source.maxLines,
    autoRename: source.autoRename,
  };
}

/** A copy of a node and its layers, as a duplicate or an instance's sublayer gets. */
function copyNode(file: FileState, source: NodeState, type: NodeType, id?: string): NodeState {
  return Object.assign(createNode(file, type, source.name, id), copiedFields(source));
}

/** A duplicate of a node with its layers and its shared plugin data, as Figma's clone makes. */
function duplicate(file: FileState, source: NodeState): NodeState {
  const copy = copyNode(file, source, source.type);
  copy.exposedInstance = source.exposedInstance;
  for (const [key, value] of source.sharedData) {
    copy.sharedData.set(key, value);
  }
  for (const [id, property] of source.properties) {
    copy.properties.set(id, property);
  }
  if (source.type !== "INSTANCE") {
    copy.children = source.children.map((child) => {
      const childCopy = duplicate(file, child);
      childCopy.parent = copy;
      return childCopy;
    });
  }
  return copy;
}

/** Put a node the API makes on the current page, as Figma does. */
function placeOnCurrentPage(file: FileState, state: NodeState): void {
  const page = file.current;
  if (page === undefined) {
    throw new Error("The fake Figma file has no current page.");
  }
  insert(page, state, undefined);
}

/** A shared plugin data entry as a node reads it: its own, or a sublayer's main layer's (rule 36). */
function sharedDataOf(state: NodeState, entry: string): string {
  return (
    state.sharedData.get(entry) ?? (state.mirrorOf === undefined ? "" : sharedDataOf(state.mirrorOf, entry))
  );
}

/** The members every node has. */
class FakeBaseNode {
  get id(): string {
    return stateOf(this).id;
  }

  get removed(): boolean {
    return stateOf(this).removed;
  }

  get name(): string {
    return live(this).name;
  }

  set name(value: string) {
    const state = live(this);
    write(state, "name");
    const set = state.parent?.type === "COMPONENT_SET" ? state.parent : undefined;
    const before = set === undefined ? undefined : variantValues(state.name);
    state.name = value;
    state.autoRename = false;
    markOverride(state, "name");
    if (set !== undefined && before !== undefined) {
      renameVariantValues(set, state, before, variantValues(value));
    }
  }

  /** Rule 36: a sublayer reads its main layer's entry where it holds none of its own. */
  getSharedPluginData(namespace: string, key: string): string {
    return sharedDataOf(live(this), `${namespace}${SHARED_DATA_SEPARATOR}${key}`);
  }

  setSharedPluginData(namespace: string, key: string, value: string): void {
    const state = live(this);
    write(state, `shared plugin data ${namespace}/${key}`);
    const entry = `${namespace}${SHARED_DATA_SEPARATOR}${key}`;
    if (value === "") {
      state.sharedData.delete(entry);
    } else {
      state.sharedData.set(entry, value);
    }
  }
}

class FakeDocument extends FakeBaseNode {
  get type(): "DOCUMENT" {
    return "DOCUMENT";
  }

  get children(): ReadonlyArray<PageNode> {
    return live(this).children.map(pageOf);
  }
}

class FakePage extends FakeBaseNode {
  get type(): "PAGE" {
    return "PAGE";
  }

  get children(): ReadonlyArray<SceneNode> {
    return childrenOf(live(this)).map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }

  loadAsync(): Promise<void> {
    live(this).loaded = true;
    return Promise.resolve();
  }

  remove(): void {
    const state = live(this);
    if (state.file.current === state) {
      throw new Error(`Cannot remove ${state.id}, the current page.`);
    }
    if (state.parent?.children.length === 1) {
      throw new Error(`Cannot remove ${state.id}, the file's last page.`);
    }
    write(state, "remove");
    detach(state);
    markRemoved(state);
  }
}

/**
 * Pin a collection's mode on a node. The typings deprecate passing a collection id, which
 * throws under `"documentAccess": "dynamic-page"`, so the fake takes only a collection.
 */
function pinMode(state: NodeState, collection: VariableCollection, modeId: string): void {
  const found = state.file.collections.find((candidate) => candidate.id === collection.id);
  if (found === undefined || !found.modes.some((mode) => mode.modeId === modeId)) {
    throw new Error(`The file has no collection ${String(collection.id)} with a mode ${modeId}.`);
  }
  write(state, `pin ${found.name} to ${modeId}`);
  state.explicitModes.set(found.id, modeId);
}

/** The members every layer has. */
class FakeSceneNode extends FakeBaseNode {
  /**
   * The page or layer that holds the layer, as the typings name it, or null where none does. The
   * plugin reads it to find a hidden child's fill (rule 42).
   */
  get parent(): (BaseNode & ChildrenMixin) | null {
    const parent = live(this).parent?.exposed;
    return parent === undefined || parent.type === "DOCUMENT" || !("children" in parent) ? null : parent;
  }

  remove(): void {
    const state = live(this);
    if (state.mirrorOf !== undefined) {
      throw new Error(`Cannot remove ${state.id}, a layer inside an instance.`);
    }
    write(state, "remove");
    detach(state);
    markRemoved(state);
  }

  get x(): number {
    return live(this).x;
  }

  set x(value: number) {
    const state = live(this);
    // The typings: an auto layout frame places its children, and a write to their x is a no-op,
    // apart from an absolute child's (rule 24).
    if (placesItself(state)) {
      write(state, "x");
      state.x = f32(value);
    }
  }

  get y(): number {
    return live(this).y;
  }

  set y(value: number) {
    const state = live(this);
    if (placesItself(state)) {
      write(state, "y");
      state.y = f32(value);
    }
  }

  get rotation(): number {
    return live(this).rotation;
  }

  /**
   * Rule 26. A layer in an auto layout flow keeps its box in its slot, so its origin moves with the
   * turn and the box keeps its center. Any other layer turns about its top left, as the typings say.
   */
  set rotation(value: number) {
    const state = live(this);
    const rotation = readBackRotation(f32(value));
    if (!placesItself(state)) {
      const halfWidth = state.width / 2;
      const halfHeight = state.height / 2;
      const center = mapPoint(relativeTransform(state), halfWidth, halfHeight);
      const { cos, sin } = turnOf(rotation);
      state.x = f32(center.x - (cos * halfWidth + sin * halfHeight));
      state.y = f32(center.y - (cos * halfHeight - sin * halfWidth));
    }
    write(state, "rotation");
    state.rotation = rotation;
  }

  /**
   * Rule 25: false for a layer a BOOLEAN property hides, and true for every other layer, since no
   * probe wrote `visible`.
   */
  get visible(): boolean {
    return !hiddenByProperty(live(this));
  }

  get layoutPositioning(): FrameNode["layoutPositioning"] {
    return live(this).layoutPositioning;
  }

  /**
   * Rule 24. The typings take ABSOLUTE only on a child of an auto layout frame, and no probe turned
   * a filling layer absolute, so the fake throws for both.
   */
  set layoutPositioning(value: FrameNode["layoutPositioning"]) {
    const state = live(this);
    if (
      value === "ABSOLUTE" &&
      (!isAutoLayout(state.parent) || fills(state, "HORIZONTAL") || fills(state, "VERTICAL"))
    ) {
      throw new Error(
        `The fake Figma file does not model layoutPositioning ABSOLUTE on ${state.id}, which is no auto layout child or fills its parent.`
      );
    }
    write(state, "layoutPositioning");
    state.layoutPositioning = value;
  }

  get width(): number {
    return lengthOn(settled(live(this)), "HORIZONTAL");
  }

  get height(): number {
    return lengthOn(settled(live(this)), "VERTICAL");
  }

  get absoluteBoundingBox(): Rect | null {
    return absoluteBox(live(this));
  }

  /** The fake draws no effects or strokes, so a layer's render bounds are its box. */
  get absoluteRenderBounds(): Rect | null {
    return absoluteBox(live(this));
  }

  /** A PNG export: bytes that name the layer and the scale, since the fake draws no pixels. */
  exportAsync(settings: ExportSettingsImage): Promise<Uint8Array> {
    const state = live(this);
    if (settings.format !== "PNG") {
      throw new Error(`The fake Figma file exports only PNG, not ${settings.format}.`);
    }
    const scale = settings.constraint?.type === "SCALE" ? settings.constraint.value : 1;
    return Promise.resolve(
      Uint8Array.from(Array.from(`${state.id}@${scale}x`), (char) => char.charCodeAt(0))
    );
  }

  resize(width: number, height: number): void {
    const state = live(this);
    resizeWithConstraints(state, width, height);
    write(state, "resize");
  }

  resizeWithoutConstraints(width: number, height: number): void {
    const state = live(this);
    resize(state, width, height);
    write(state, "resizeWithoutConstraints");
  }

  rescale(scale: number): void {
    const state = live(this);
    if (scale < 0.01) {
      throw new Error(`Cannot rescale ${state.id} by ${scale}: the scale must be at least 0.01.`);
    }
    write(state, "rescale");
    rescale(state, scale);
  }

  get opacity(): number {
    return live(this).opacity;
  }

  set opacity(value: number) {
    const state = live(this);
    write(state, "opacity");
    state.opacity = f32(value);
  }

  get constraints(): Constraints {
    return live(this).constraints;
  }

  set constraints(value: Constraints) {
    const state = live(this);
    write(state, "constraints");
    state.constraints = { ...value };
  }

  /** Rule 12: the fill along an auto layout parent's direction, which only the shorthand writes. */
  get layoutGrow(): number {
    return live(this).layoutGrow;
  }

  /** Rule 12: the stretch across an auto layout parent, which only the shorthand writes. */
  get layoutAlign(): "INHERIT" | "STRETCH" {
    return live(this).layoutAlign;
  }

  get layoutSizingHorizontal(): Sizing {
    return sizingOn(live(this), "HORIZONTAL");
  }

  set layoutSizingHorizontal(value: Sizing) {
    setSizing(live(this), "HORIZONTAL", value);
  }

  get layoutSizingVertical(): Sizing {
    return sizingOn(live(this), "VERTICAL");
  }

  set layoutSizingVertical(value: Sizing) {
    setSizing(live(this), "VERTICAL", value);
  }

  get minWidth(): number | null {
    return live(this).limits.minWidth;
  }

  set minWidth(value: number | null) {
    setLimit(live(this), "minWidth", value);
  }

  get maxWidth(): number | null {
    return live(this).limits.maxWidth;
  }

  set maxWidth(value: number | null) {
    setLimit(live(this), "maxWidth", value);
  }

  get minHeight(): number | null {
    return live(this).limits.minHeight;
  }

  set minHeight(value: number | null) {
    setLimit(live(this), "minHeight", value);
  }

  get maxHeight(): number | null {
    return live(this).limits.maxHeight;
  }

  set maxHeight(value: number | null) {
    setLimit(live(this), "maxHeight", value);
  }

  get boundVariables(): FrameNode["boundVariables"] {
    return nodeBindings(live(this));
  }

  setBoundVariable(field: BindableField, variable: Variable | null): void {
    const state = live(this);
    if (isTextField(field)) {
      throw new Error(`${state.id} is a ${state.type}, which has no ${field}.`);
    }
    if (field === "characters") {
      throw new Error(`${state.id} is a ${state.type}, which has no characters.`);
    }
    bindNodeField(state, field, variable);
  }

  get componentPropertyReferences(): FrameNode["componentPropertyReferences"] {
    const references = live(this).propertyReferences;
    return references === null ? null : { ...references };
  }

  set componentPropertyReferences(references: FrameNode["componentPropertyReferences"]) {
    linkProperties(live(this), references);
  }

  get explicitVariableModes(): { [collectionId: string]: string } {
    return Object.fromEntries(live(this).explicitModes);
  }

  setExplicitVariableModeForCollection(collection: VariableCollection, modeId: string): void {
    pinMode(live(this), collection, modeId);
  }

  /**
   * The mode the layer reads each collection in, pinned or inherited or the default (rule 8),
   * for the collections its subtree's bindings read (rule 11).
   */
  get resolvedVariableModes(): { [collectionId: string]: string } {
    const state = live(this);
    const bound = boundCollections(state);
    return Object.fromEntries(
      state.file.collections
        .filter((collection) => bound.has(collection.id))
        .map((collection) => [collection.id, modeFor(state, collection)])
    );
  }
}

const BASE64_DIGITS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 with padding, as `figma.base64Encode` returns it. */
function base64Encode(data: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < data.length; index += 3) {
    const bits = ((data[index] ?? 0) << 16) | ((data[index + 1] ?? 0) << 8) | (data[index + 2] ?? 0);
    const digit = (shift: number) => BASE64_DIGITS.charAt((bits >> shift) & 63);
    encoded += digit(18) + digit(12);
    encoded += index + 1 < data.length ? digit(6) : "=";
    encoded += index + 2 < data.length ? digit(0) : "=";
  }
  return encoded;
}

/** Standard base64, with or without padding, decoded as `figma.base64Decode` decodes it (rule 22). */
function base64Decode(data: string): Uint8Array {
  const bytes: number[] = [];
  let bits = 0;
  let count = 0;
  for (const char of data.replace(/=+$/, "")) {
    const digit = BASE64_DIGITS.indexOf(char);
    if (digit < 0) {
      throw new Error(`The fake Figma file decodes standard base64, which has no ${char}.`);
    }
    bits = (bits << 6) | digit;
    count += 6;
    if (count >= 8) {
      count -= 8;
      bytes.push((bits >> count) & 0xff);
      bits &= (1 << count) - 1;
    }
  }
  return Uint8Array.from(bytes);
}

/**
 * The bytes a PNG file opens with: its signature, then the IHDR chunk's length, 13, and its type
 * (PNG specification §5.2, §11.2.2). The chunk's 13 bytes of data and its CRC follow.
 */
const PNG_HEADER_START = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
];

/** The signature and the whole IHDR chunk: 8 bytes, then 4 of length, 4 of type, 13 of data and 4 of CRC. */
const PNG_HEADER_LENGTH = 33;

/** An image the file stores, which a paint names by its hash. It is no node. */
function exposeImage(hash: string): Image {
  // SAFETY: the object models the image member the plugin reads, and the guard throws for every
  // other member.
  return guard({ hash }, "Image") as Image;
}

/** Store an image's bytes under their SHA-1, refusing bytes without a whole PNG header (rule 22). */
function createImage(file: FileState, bytes: Uint8Array): Image {
  const header =
    bytes.length >= PNG_HEADER_LENGTH && PNG_HEADER_START.every((byte, index) => bytes[index] === byte);
  if (!header) {
    throw new Error("in createImage: Image type is unsupported");
  }
  const hash = sha1Hex(bytes);
  file.images.add(hash);
  file.writes.push(`store the image ${hash}`);
  return exposeImage(hash);
}

/**
 * A layer's box on its page: its position plus each ancestor's, up to the page. Where the layer or
 * a frame around it is turned, the box bounds the layer's turned corners (rule 26).
 */
function absoluteBox(state: NodeState): Rect {
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

/** A layer's transform within its parent, as `relativeTransform` holds it: its turn, then its place. */
type Transform = readonly [readonly [number, number, number], readonly [number, number, number]];

/**
 * The cosine and sine of a turn in degrees, exact where they are whole, as at each quarter turn, so
 * a half turn lands on whole pixels as the real file's did (rule 26).
 */
function turnOf(degrees: number) {
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
function readBackRotation(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

/** Rule 26: the typings' `atan2(-m10, m00)` reads `rotation` from this matrix. */
function relativeTransform(state: NodeState): Transform {
  const { cos, sin } = turnOf(state.rotation);
  return [
    [cos, sin, state.x],
    [-sin, cos, state.y],
  ];
}

function mapPoint(transform: Transform, x: number, y: number) {
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

/** The members of frames, components, component sets and instances. */
class FakeFrameLikeNode extends FakeSceneNode {
  /**
   * An instance lists every sublayer, and leaves out one a BOOLEAN property hides only while
   * `figma.skipInvisibleInstanceChildren` is set (rule 25).
   */
  get children(): ReadonlyArray<SceneNode> {
    const state = live(this);
    const skipped = (child: NodeState): boolean =>
      state.file.skipInvisibleInstanceChildren && child.mirrorOf !== undefined && hiddenByProperty(child);
    return childrenOf(state)
      .filter((child) => !skipped(child))
      .map(sceneOf);
  }

  appendChild(child: SceneNode): void {
    insert(live(this), live(child), undefined);
  }

  insertChild(index: number, child: SceneNode): void {
    insert(live(this), live(child), index);
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  get strokes(): ReadonlyArray<Paint> {
    return shown(live(this), "strokes");
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map((paint) => storePaint(state.file, paint));
    noteOverride(state, "strokes");
  }

  get strokeWeight(): number | PluginAPI["mixed"] {
    const { top, right, bottom, left } = live(this).strokeWeights;
    return top === right && right === bottom && bottom === left ? top : MIXED;
  }

  set strokeWeight(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a stroke weight.");
    }
    write(state, "strokeWeight");
    const weight = f32(value);
    state.strokeWeights = { top: weight, right: weight, bottom: weight, left: weight };
  }

  get strokeTopWeight(): number {
    return live(this).strokeWeights.top;
  }

  get strokeRightWeight(): number {
    return live(this).strokeWeights.right;
  }

  get strokeBottomWeight(): number {
    return live(this).strokeWeights.bottom;
  }

  get strokeLeftWeight(): number {
    return live(this).strokeWeights.left;
  }

  get strokeAlign(): FrameNode["strokeAlign"] {
    return live(this).strokeAlign;
  }

  set strokeAlign(value: FrameNode["strokeAlign"]) {
    const state = live(this);
    write(state, "strokeAlign");
    state.strokeAlign = value;
  }

  get strokesIncludedInLayout(): boolean {
    return live(this).strokesIncludedInLayout;
  }

  set strokesIncludedInLayout(value: boolean) {
    const state = live(this);
    write(state, "strokesIncludedInLayout");
    state.strokesIncludedInLayout = value;
  }

  get dashPattern(): ReadonlyArray<number> {
    return live(this).dashPattern;
  }

  set dashPattern(lengths: ReadonlyArray<number>) {
    const state = live(this);
    write(state, "dashPattern");
    state.dashPattern = lengths.map((length) => f32(length));
  }

  get effects(): ReadonlyArray<Effect> {
    return shown(live(this), "effects");
  }

  /** Rule 2: a new color binding stores the variable's value, a held one keeps the color written. */
  set effects(effects: ReadonlyArray<Effect>) {
    const state = live(this);
    write(state, "effects");
    const held = heldColorBindings(shown(state, "effects"));
    state.effects = effects.map((effect) => storeEffect(state, effect, held));
    noteOverride(state, "effects");
  }

  get cornerRadius(): number | PluginAPI["mixed"] {
    const { topLeft, topRight, bottomRight, bottomLeft } = shown(live(this), "radii");
    return topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft ? topLeft : MIXED;
  }

  set cornerRadius(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a corner radius.");
    }
    write(state, "cornerRadius");
    const radius = f32(value);
    state.radii = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
    noteOverride(state, "radii");
  }

  get topLeftRadius(): number {
    return shown(live(this), "radii").topLeft;
  }

  get topRightRadius(): number {
    return shown(live(this), "radii").topRight;
  }

  get bottomRightRadius(): number {
    return shown(live(this), "radii").bottomRight;
  }

  get bottomLeftRadius(): number {
    return shown(live(this), "radii").bottomLeft;
  }

  get clipsContent(): boolean {
    return live(this).clipsContent;
  }

  set clipsContent(value: boolean) {
    const state = live(this);
    write(state, "clipsContent");
    state.clipsContent = value;
  }

  get itemReverseZIndex(): boolean {
    return live(this).itemReverseZIndex;
  }

  set itemReverseZIndex(value: boolean) {
    const state = live(this);
    if (value && state.layoutMode !== "VERTICAL") {
      throw new Error(
        `The fake Figma file models itemReverseZIndex only on a vertical auto layout (PZ2), and ${state.id} is ${state.layoutMode === "NONE" ? "no auto layout" : "a horizontal one"}.`
      );
    }
    write(state, "itemReverseZIndex");
    state.itemReverseZIndex = value;
  }

  get layoutMode(): FrameNode["layoutMode"] {
    return live(this).layoutMode;
  }

  set layoutMode(value: FrameNode["layoutMode"]) {
    const state = live(this);
    write(state, "layoutMode");
    state.layoutMode = value;
  }

  get layoutWrap(): FrameNode["layoutWrap"] {
    return live(this).layoutWrap;
  }

  set layoutWrap(value: FrameNode["layoutWrap"]) {
    const state = live(this);
    if (state.layoutMode !== "HORIZONTAL" && state.layoutMode !== "VERTICAL") {
      throw new Error(
        `layoutWrap needs a horizontal or vertical auto layout, and ${state.id} has ${state.layoutMode}.`
      );
    }
    write(state, "layoutWrap");
    state.layoutWrap = value;
  }

  get primaryAxisSizingMode(): FrameNode["primaryAxisSizingMode"] {
    return live(this).primaryAxisSizingMode;
  }

  set primaryAxisSizingMode(value: FrameNode["primaryAxisSizingMode"]) {
    const state = live(this);
    write(state, "primaryAxisSizingMode");
    state.primaryAxisSizingMode = value;
  }

  get counterAxisSizingMode(): FrameNode["counterAxisSizingMode"] {
    return live(this).counterAxisSizingMode;
  }

  set counterAxisSizingMode(value: FrameNode["counterAxisSizingMode"]) {
    const state = live(this);
    write(state, "counterAxisSizingMode");
    state.counterAxisSizingMode = value;
  }

  get primaryAxisAlignItems(): FrameNode["primaryAxisAlignItems"] {
    return live(this).primaryAxisAlignItems;
  }

  set primaryAxisAlignItems(value: FrameNode["primaryAxisAlignItems"]) {
    const state = live(this);
    write(state, "primaryAxisAlignItems");
    state.primaryAxisAlignItems = value;
  }

  get counterAxisAlignItems(): FrameNode["counterAxisAlignItems"] {
    return live(this).counterAxisAlignItems;
  }

  /** Rule 17: no STRETCH, and BASELINE only in a row. */
  set counterAxisAlignItems(value: FrameNode["counterAxisAlignItems"]) {
    const state = live(this);
    // The typings leave STRETCH out of the type, so only a cast reaches this check.
    if (!["MIN", "CENTER", "MAX", "BASELINE"].includes(value)) {
      throw new Error(
        `counterAxisAlignItems takes no ${value}. Stretch a child with layoutSizing* FILL instead.`
      );
    }
    if (value === "BASELINE" && state.layoutMode !== "HORIZONTAL") {
      throw new Error(
        `BASELINE can only be set on horizontal auto-layout frames, and ${state.id} has ${state.layoutMode}.`
      );
    }
    write(state, "counterAxisAlignItems");
    state.counterAxisAlignItems = value;
  }

  get paddingTop(): number {
    return live(this).padding.top;
  }

  set paddingTop(value: number) {
    const state = live(this);
    write(state, "paddingTop");
    state.padding.top = f32(value);
  }

  get paddingRight(): number {
    return live(this).padding.right;
  }

  set paddingRight(value: number) {
    const state = live(this);
    write(state, "paddingRight");
    state.padding.right = f32(value);
  }

  get paddingBottom(): number {
    return live(this).padding.bottom;
  }

  set paddingBottom(value: number) {
    const state = live(this);
    write(state, "paddingBottom");
    state.padding.bottom = f32(value);
  }

  get paddingLeft(): number {
    return live(this).padding.left;
  }

  set paddingLeft(value: number) {
    const state = live(this);
    write(state, "paddingLeft");
    state.padding.left = f32(value);
  }

  get itemSpacing(): number {
    return live(this).itemSpacing;
  }

  set itemSpacing(value: number) {
    const state = live(this);
    write(state, "itemSpacing");
    state.itemSpacing = f32(value);
  }

  get counterAxisSpacing(): number | null {
    return live(this).counterAxisSpacing;
  }

  set counterAxisSpacing(value: number | null) {
    const state = live(this);
    write(state, "counterAxisSpacing");
    state.counterAxisSpacing = value === null ? null : f32(value);
  }
}

class FakeFrame extends FakeFrameLikeNode {
  get type(): "FRAME" {
    return "FRAME";
  }
}

class FakeComponent extends FakeFrameLikeNode {
  get type(): "COMPONENT" {
    return "COMPONENT";
  }

  get key(): string {
    return componentKey(live(this));
  }

  createInstance(): InstanceNode {
    const main = live(this);
    const instance = copyNode(main.file, main, "INSTANCE");
    instance.main = main;
    instance.bindings.clear();
    instance.propertyReferences = null;
    placeOnCurrentPage(main.file, instance);
    write(instance, `create an instance of ${main.id}`);
    const node = instance.exposed;
    if (node.type !== "INSTANCE") {
      throw new Error(`${instance.id} is a ${node.type}, not an instance.`);
    }
    return node;
  }

  clone(): ComponentNode {
    const state = live(this);
    const copy = duplicate(state.file, state);
    placeOnCurrentPage(state.file, copy);
    write(copy, `duplicate ${state.id}`);
    return componentOf(copy);
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    const state = live(this);
    requirePropertyHolder(state);
    return definitions(state);
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeComponentSet extends FakeFrameLikeNode {
  get type(): "COMPONENT_SET" {
    return "COMPONENT_SET";
  }

  get defaultVariant(): ComponentNode {
    return componentOf(defaultVariant(live(this)));
  }

  get componentPropertyDefinitions(): ComponentPropertyDefinitions {
    return definitions(live(this));
  }

  addComponentProperty(
    propertyName: string,
    type: ComponentPropertyType,
    defaultValue: string | boolean | VariableAlias,
    options?: ComponentPropertyOptions
  ): string {
    return addProperty(live(this), propertyName, type, defaultValue, options);
  }

  editComponentProperty(
    propertyName: string,
    newValue: Parameters<ComponentSetNode["editComponentProperty"]>[1]
  ): string {
    return editProperty(live(this), propertyName, newValue);
  }
}

class FakeInstance extends FakeFrameLikeNode {
  get type(): "INSTANCE" {
    return "INSTANCE";
  }

  get mainComponent(): ComponentNode | null {
    throw new Error(
      'An instance\'s mainComponent is write-only under "documentAccess": "dynamic-page". Use getMainComponentAsync.'
    );
  }

  getMainComponentAsync(): Promise<ComponentNode | null> {
    const main = live(this).main;
    return Promise.resolve(main === undefined ? null : componentOf(main));
  }

  /** Rule 35: the instance keeps its node and its property values. */
  swapComponent(componentNode: ComponentNode): void {
    const state = live(this);
    const main = live(componentNode);
    if (main.type !== "COMPONENT") {
      throw new Error(`An instance swaps only to a component, and ${main.id} is a ${main.type}.`);
    }
    write(state, `swap to ${main.id}`);
    swapTo(state, main);
  }

  /**
   * Rules 25 and 34: the variant values the main component's name holds, then each property of its
   * set or component at the value the instance sets, or else at its default.
   */
  get componentProperties(): ComponentProperties {
    const state = live(this);
    const { main, owner } = instanceOwner(state);
    const properties: ComponentProperties = {};
    if (owner !== main) {
      for (const [name, value] of variantValues(main.name) ?? []) {
        properties[name] = { type: "VARIANT", value };
      }
    }
    for (const [id, { type, value }] of shownProperties(state)) {
      properties[id] = { type, value };
    }
    return properties;
  }

  /** Rules 25 and 34. */
  setProperties(properties: { [propertyName: string]: string | boolean | VariableAlias }): void {
    setProperties(live(this), properties);
  }

  /** Rule 39: an instance reads its own mark, or the one its main layer carries. */
  get isExposedInstance(): boolean {
    return exposedOf(live(this));
  }

  set isExposedInstance(value: boolean) {
    const state = live(this);
    const component = nearestComponent(state);
    if (state.mirrorOf !== undefined || component?.parent?.type !== "COMPONENT_SET") {
      throw new Error(
        `The fake Figma file writes isExposedInstance only on an instance inside a component in a set (N5), and ${state.id} is none.`
      );
    }
    write(state, "isExposedInstance");
    state.exposedInstance = value;
  }

  /** Rule 39: the instances below this one that their main layers expose. */
  get exposedInstances(): InstanceNode[] {
    return exposedBelow(live(this)).map((state) => {
      const node = state.exposed;
      if (node.type !== "INSTANCE") {
        throw new Error(`${state.id} is a ${node.type}, not an instance.`);
      }
      return node;
    });
  }

  /** Rule 37: each layer with an override, from the instance down, and its overridden fields. */
  get overrides(): { id: string; overriddenFields: NodeChangeProperty[] }[] {
    const entries: { id: string; overriddenFields: NodeChangeProperty[] }[] = [];
    const visit = (state: NodeState): void => {
      const fields = [...state.overridden].flatMap((field) => OVERRIDE_FIELDS.get(field) ?? []);
      if (fields.length > 0) {
        entries.push({ id: state.id, overriddenFields: fields });
      }
      for (const child of childrenOf(state)) {
        visit(child);
      }
    };
    visit(live(this));
    return entries;
  }

  /** Rule 37: the typings' "removes all direct overrides", which keeps the property values. */
  removeOverrides(): void {
    const state = live(this);
    write(state, "remove overrides");
    const clear = (layer: NodeState): void => {
      const source = sourceOf(layer);
      if (layer.overridden.has("name") && source !== undefined) {
        layer.name = source.name;
      }
      for (const field of OVERRIDE_FIELDS.keys()) {
        layer.overridden.delete(field);
      }
      for (const child of childrenOf(layer)) {
        clear(child);
      }
    };
    clear(state);
  }
}

/**
 * The fields `overrides` lists for each override the fake notes (rule 37): N1 listed an instance's
 * `name`, `width` and `height`, and N3 its `fills`, `effects` and "the corner fields", which the fake
 * takes as the four corners the typings name and `cornerRadius`, and a sublayer's `fills`.
 */
const OVERRIDE_FIELDS: ReadonlyMap<string, readonly NodeChangeProperty[]> = new Map<
  string,
  readonly NodeChangeProperty[]
>([
  ["name", ["name"]],
  ["width", ["width"]],
  ["height", ["height"]],
  ["fills", ["fills"]],
  ["strokes", ["strokes"]],
  ["effects", ["effects"]],
  ["radii", ["cornerRadius", "topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]],
  ["characters", ["characters"]],
  ["textAlignHorizontal", ["textAlignHorizontal"]],
  ["minWidth", ["minWidth"]],
  ["minHeight", ["minHeight"]],
  ["componentProperties", ["componentProperties"]],
]);

/**
 * Whether an instance is exposed (rule 39): a primary instance by its own mark, and an instance seen
 * through an outer instance by the mark its main layer carries, which it inherits.
 */
function exposedOf(state: NodeState): boolean {
  return state.mirrorOf === undefined ? state.exposedInstance : exposedOf(state.mirrorOf);
}

/** The nearest component around a layer. */
function nearestComponent(state: NodeState): NodeState | undefined {
  let current = state.parent;
  while (current !== undefined && current.type !== "COMPONENT") {
    current = current.parent;
  }
  return current;
}

/** The exposed instances below a layer, each one before those exposed below it (rules 39 and 45). */
function exposedBelow(state: NodeState): readonly NodeState[] {
  return childrenOf(state).flatMap((child) =>
    child.type === "INSTANCE" && exposedOf(child) ? [child, ...exposedBelow(child)] : exposedBelow(child)
  );
}

/** A layer's place among its siblings: its name and its index among the siblings of that name (PN2). */
type NamedPlace = { readonly name: string; readonly index: number };

/** The property values a sublayer instance sets itself, at the places of the layers down to it (rule 45). */
type NestedValues = {
  readonly places: readonly NamedPlace[];
  readonly values: ReadonlyMap<string, string | boolean>;
};

/** A child's place among its siblings: its name, and how many siblings before it share that name. */
function placeOf(siblings: readonly NodeState[], child: NodeState): NamedPlace {
  const index = siblings.filter((sibling) => sibling.name === child.name).indexOf(child);
  return { name: child.name, index };
}

/** The values each sublayer instance below a layer sets itself, as the layer holds them now. */
function nestedValues(state: NodeState, places: readonly NamedPlace[] = []): readonly NestedValues[] {
  return state.children.flatMap((child) => {
    const at = [...places, placeOf(state.children, child)];
    const own = child.overridden.has("componentProperties")
      ? [{ places: at, values: new Map(child.propertyValues) }]
      : [];
    return [...own, ...nestedValues(child, at)];
  });
}

/**
 * Give the sublayer instance at each entry's places the values it set before a swap: the sibling of
 * the same name in the same place among those of that name, as a real file kept them (rule 45, PN2).
 */
function restoreNested(state: NodeState, nested: readonly NestedValues[]): void {
  for (const { places, values } of nested) {
    let at: NodeState | undefined = state;
    for (const { name, index } of places) {
      at = at === undefined ? undefined : childrenOf(at).filter((child) => child.name === name)[index];
    }
    if (at?.type === "INSTANCE") {
      for (const [id, value] of values) {
        at.propertyValues.set(id, value);
      }
      at.overridden.add("componentProperties");
    }
  }
}

/**
 * Point an instance at another component, keeping its node, its property values and its own
 * overrides (rules 35 and 37). A nested instance that swaps keeps the component apart from its main
 * layer. The swap properties the instance sets swap their layers in the new component too.
 */
function swapTo(state: NodeState, main: NodeState): void {
  const nested = nestedValues(state);
  state.main = main;
  if (state.mirrorOf !== undefined) {
    state.overridden.add("mainComponent");
  }
  mirror(state, main, true);
  restoreNested(state, nested);
  applySwapValues(state);
}

/**
 * The layers below an instance whose main layers link a property of `field`, down to the instances
 * nested in it, which set their own properties.
 */
function linkedBelow(
  state: NodeState,
  field: "characters" | "mainComponent",
  id: string
): readonly NodeState[] {
  return childrenOf(state).flatMap((child) => {
    const linked = rootMain(child).propertyReferences?.[field] === id ? [child] : [];
    return child.type === "INSTANCE" ? linked : [...linked, ...linkedBelow(child, field, id)];
  });
}

/** A property's value as an instance shows it, and whether an instance set it rather than defaulted. */
type ShownProperty = {
  readonly type: PropertyState["type"];
  readonly value: string | boolean;
  readonly given: boolean;
};

/**
 * Each TEXT, BOOLEAN and INSTANCE_SWAP property of an instance's set or component at the value the
 * instance shows (rules 25 and 34): the one it sets, or the one the instance it shows through sets,
 * as an outer instance shows the values a component set on the instance nested in it (N1), or else
 * the default. `componentProperties` reads it, and a swap applies the swap values an instance set.
 */
function shownProperties(state: NodeState): ReadonlyMap<string, ShownProperty> {
  const { owner } = instanceOwner(state);
  return new Map(
    [...owner.properties].map(([id, property]) => {
      const given = propertyValue(state, id);
      return [id, { type: property.type, value: given ?? property.defaultValue, given: given !== undefined }];
    })
  );
}

/**
 * Swap each layer a set INSTANCE_SWAP value the instance shows links to the component the value
 * names (rule 34). The layer keeps its name, and `overrides` lists its `name` (rule 43). A layer whose
 * property no instance set shows its main layer's component.
 */
function applySwapValues(state: NodeState): void {
  for (const [id, { type, value, given }] of shownProperties(state)) {
    if (type !== "INSTANCE_SWAP" || !given || value === true || value === false) {
      continue;
    }
    const component = componentWithId(state.file, value);
    for (const layer of linkedBelow(state, "mainComponent", id)) {
      if (layer.main !== component) {
        swapTo(layer, component);
        layer.overridden.add("name");
      }
    }
  }
}

/**
 * Set an instance's properties (rules 25 and 34). A VARIANT goes by its bare name and shows the
 * set's variant with the values asked for, through a swap that keeps the node and the other values,
 * as N1's did. A TEXT goes by its id and sets the characters the layers linked to it show, and
 * needs their fonts loaded, as every text write does (rule 7), since N1 ran with them loaded. A
 * BOOLEAN shows or hides its layers (PB). An INSTANCE_SWAP takes a component's id and swaps the
 * layers linked to it, as NS's did.
 */
function setProperties(
  state: NodeState,
  properties: { readonly [propertyName: string]: string | boolean | VariableAlias }
): void {
  const { main, owner } = instanceOwner(state);
  const options = owner === main ? new Map<string, string[]>() : variantOptions(owner);
  const variant = new Map(variantValues(main.name) ?? []);
  const values: (readonly [string, string | boolean])[] = [];
  for (const [name, given] of Object.entries(properties)) {
    const value = propertyInput(name, given);
    const flag = value === true || value === false;
    const choices = options.get(name);
    if (choices !== undefined) {
      if (value === true || value === false || !choices.includes(value)) {
        throw new Error(`${owner.id} has no ${name} ${String(value)} to show.`);
      }
      variant.set(name, value);
      continue;
    }
    const property = owner.properties.get(name);
    if (property === undefined) {
      throw new Error(`${state.id} shows no property ${name} to set.`);
    }
    if (flag !== (property.type === "BOOLEAN")) {
      throw new Error(`The ${property.type} property ${name} takes no ${String(value)}.`);
    }
    if (property.type === "INSTANCE_SWAP" && value !== true && value !== false) {
      componentWithId(state.file, value);
    }
    if (property.type === "TEXT") {
      for (const text of linkedBelow(state, "characters", name)) {
        requireHeldFonts(text, "characters");
      }
    }
    values.push([name, value]);
  }
  const target = owner === main ? main : variantWith(owner, variant);
  write(state, "set properties");
  for (const [id, value] of values) {
    state.propertyValues.set(id, value);
  }
  // A sublayer's values are an override of the instance around it (rule 45).
  if (state.mirrorOf !== undefined && values.length > 0) {
    state.overridden.add("componentProperties");
  }
  if (target !== main) {
    swapTo(state, target);
  } else {
    applySwapValues(state);
  }
}

/** A value `setProperties` was given, refusing a variable, which no probe set (rule 34). */
function propertyInput(name: string, value: string | boolean | VariableAlias): string | boolean {
  if (value === true || value === false || isText(value)) {
    return value;
  }
  throw new Error(`The fake Figma file does not model setting ${name} to a variable.`);
}

/** The variant of a set that shows every value asked for (rule 34). */
function variantWith(set: NodeState, values: ReadonlyMap<string, string>): NodeState {
  const found = set.children.find((child) => {
    const shownValues = variantValues(child.name);
    return shownValues !== undefined && [...values].every(([name, value]) => shownValues.get(name) === value);
  });
  if (found === undefined) {
    throw new Error(
      `${set.id} has no variant ${[...values].map(([name, value]) => `${name}=${value}`).join(", ")}.`
    );
  }
  return found;
}

class FakeText extends FakeSceneNode {
  get type(): "TEXT" {
    return "TEXT";
  }

  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  /** Rule 34: a sublayer shows the TEXT property value its instance sets. */
  get characters(): string {
    return charactersOf(live(this));
  }

  /** New characters take the style of the first character (rule 10). */
  set characters(value: string) {
    const state = live(this);
    requireHeldFonts(state, "characters");
    write(state, "characters");
    markOverride(state, "characters");
    const [first] = state.styles;
    if (first === undefined) {
      throw new Error(`${state.id} holds no character style.`);
    }
    state.characters = value;
    state.styles = Array.from({ length: Math.max(1, value.length) }, () => first);
    if (state.autoRename) {
      state.name = value;
    }
    // A text that hugs its characters takes their width, and an empty one is 0 wide (rule 31).
    if (state.textAutoResize === "WIDTH_AND_HEIGHT") {
      state.width = measuredWidth(value, first.fontSize);
    }
  }

  get fontName(): FontName | PluginAPI["mixed"] {
    const [font, ...others] = heldFonts(live(this));
    return font === undefined || others.length > 0 ? MIXED : font;
  }

  set fontName(font: FontName | PluginAPI["mixed"]) {
    const state = live(this);
    if (font === MIXED) {
      throw new Error("Cannot write figma.mixed as a font.");
    }
    writeFont(state, 0, state.styles.length, font, "fontName");
  }

  get fontSize(): number | PluginAPI["mixed"] {
    return shared(live(this), (style) => style.fontSize);
  }

  set fontSize(value: number | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a font size.");
    }
    requireHeldFonts(state, "fontSize");
    write(state, "fontSize");
    const fontSize = f32(value);
    restyle(state, 0, state.styles.length, (style) => ({ ...style, fontSize }));
  }

  get lineHeight(): LineHeight | PluginAPI["mixed"] {
    return shared(live(this), (style) => style.lineHeight);
  }

  set lineHeight(value: LineHeight | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a line height.");
    }
    requireHeldFonts(state, "lineHeight");
    write(state, "lineHeight");
    const lineHeight: LineHeight =
      value.unit === "AUTO" ? { unit: "AUTO" } : { unit: value.unit, value: f32(value.value) };
    restyle(state, 0, state.styles.length, (style) => ({ ...style, lineHeight }));
  }

  get letterSpacing(): LetterSpacing | PluginAPI["mixed"] {
    return live(this).letterSpacing;
  }

  set letterSpacing(value: LetterSpacing | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a letter spacing.");
    }
    requireHeldFonts(state, "letterSpacing");
    write(state, "letterSpacing");
    state.letterSpacing = { unit: value.unit, value: f32(value.value) };
  }

  get textDecoration(): TextDecoration | PluginAPI["mixed"] {
    return live(this).textDecoration;
  }

  set textDecoration(value: TextDecoration | PluginAPI["mixed"]) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as a text decoration.");
    }
    requireHeldFonts(state, "textDecoration");
    write(state, "textDecoration");
    state.textDecoration = value;
    state.textDecorationOffset =
      value === "UNDERLINE" ? (state.textDecorationOffset ?? { unit: "AUTO" }) : null;
  }

  /** Figma holds an underline offset only while the layer is underlined. */
  get textDecorationOffset(): TextDecorationOffset | PluginAPI["mixed"] | null {
    return live(this).textDecorationOffset;
  }

  set textDecorationOffset(value: TextDecorationOffset | PluginAPI["mixed"] | null) {
    const state = live(this);
    if (value === MIXED) {
      throw new Error("Cannot write figma.mixed as an underline offset.");
    }
    requireHeldFonts(state, "textDecorationOffset");
    write(state, "textDecorationOffset");
    if (state.textDecoration === "UNDERLINE") {
      state.textDecorationOffset = value;
    }
  }

  get textAutoResize(): TextNode["textAutoResize"] {
    return live(this).textAutoResize;
  }

  /** A filling text keeps a fixed width and an auto height when asked to hug its characters (rule 19). */
  set textAutoResize(value: TextNode["textAutoResize"]) {
    const state = live(this);
    requireHeldFonts(state, "textAutoResize");
    write(state, "textAutoResize");
    if (value !== "WIDTH_AND_HEIGHT" || !fills(state, "HORIZONTAL")) {
      state.textAutoResize = value;
    }
  }

  /** A sublayer of an instance shows its main layer's alignment until it overrides it (rule 41). */
  get textAlignHorizontal(): TextNode["textAlignHorizontal"] {
    return alignmentOf(live(this));
  }

  /** On an instance's sublayer the write is an override, even one equal to the main's (rule 41). */
  set textAlignHorizontal(value: TextNode["textAlignHorizontal"]) {
    const state = live(this);
    requireHeldFonts(state, "textAlignHorizontal");
    write(state, "textAlignHorizontal");
    markOverride(state, "textAlignHorizontal");
    state.textAlignHorizontal = value;
  }

  get textAlignVertical(): TextNode["textAlignVertical"] {
    return live(this).textAlignVertical;
  }

  set textAlignVertical(value: TextNode["textAlignVertical"]) {
    const state = live(this);
    requireHeldFonts(state, "textAlignVertical");
    write(state, "textAlignVertical");
    state.textAlignVertical = value;
  }

  get textTruncation(): TextNode["textTruncation"] {
    return live(this).textTruncation;
  }

  /** Truncating starts at one line where no maximum is set, and stopping drops the maximum (rule 20). */
  set textTruncation(value: TextNode["textTruncation"]) {
    const state = live(this);
    requireHeldFonts(state, "textTruncation");
    write(state, "textTruncation");
    state.textTruncation = value;
    state.maxLines = value === "DISABLED" ? null : (state.maxLines ?? 1);
  }

  get maxLines(): number | null {
    return live(this).maxLines;
  }

  /** A maximum written while the text does not truncate changes nothing (rule 20). */
  set maxLines(value: number | null) {
    const state = live(this);
    requireHeldFonts(state, "maxLines");
    if (value !== null && !(value >= 1)) {
      throw new Error(`maxLines must be at least 1, and ${value} is not.`);
    }
    write(state, "maxLines");
    if (state.textTruncation === "ENDING") {
      state.maxLines = value;
    }
  }

  getRangeAllFontNames(start: number, end: number): FontName[] {
    const state = live(this);
    requireRange(state, start, end);
    return distinctFonts(shownStyles(state).slice(start, end));
  }

  /** The new font needs loading, as for `fontName` (rule 7). */
  setRangeFontName(start: number, end: number, font: FontName): void {
    const state = live(this);
    requireRange(state, start, end);
    writeFont(state, start, end, font, `fontName ${start}-${end}`);
  }

  getRangeBoundVariable(
    start: number,
    end: number,
    field: VariableBindableTextField
  ): VariableAlias | null | PluginAPI["mixed"] {
    const state = live(this);
    requireRange(state, start, end);
    const ids = new Set(state.styles.slice(start, end).map((style) => style.bindings.get(field)));
    const [id, ...others] = ids;
    if (others.length > 0) {
      return MIXED;
    }
    return id === undefined ? null : alias(id);
  }

  setRangeBoundVariable(
    start: number,
    end: number,
    field: VariableBindableTextField,
    variable: Variable | null
  ): void {
    const state = live(this);
    requireRange(state, start, end);
    bindTextRange(state, start, end, field, variable);
  }

  override setBoundVariable(field: BindableField, variable: Variable | null): void {
    bindTextField(live(this), field, variable);
  }
}

function requireRange(state: NodeState, start: number, end: number): void {
  const { length } = charactersOf(state);
  if (start < 0 || end > length || start >= end) {
    throw new Error(`The range ${start} to ${end} is outside the ${length} characters of ${state.id}.`);
  }
}

/**
 * The style of each character a text shows. A sublayer that shows a TEXT property's characters gives
 * each its first character's style, as written characters take it (rules 10 and 34).
 */
function shownStyles(state: NodeState): readonly CharacterStyle[] {
  const shown = charactersOf(state);
  const [first] = state.styles;
  return shown === state.characters || first === undefined
    ? state.styles
    : Array.from({ length: Math.max(1, shown.length) }, () => first);
}

class FakeVector extends FakeSceneNode {
  get type(): "VECTOR" {
    return "VECTOR";
  }

  /** A sublayer of an instance shows its main layer's fills until they are overridden (rule 38). */
  get fills(): ReadonlyArray<Paint> | PluginAPI["mixed"] {
    return shown(live(this), "fills");
  }

  set fills(paints: ReadonlyArray<Paint> | PluginAPI["mixed"]) {
    writeFills(live(this), paints);
  }

  get strokes(): ReadonlyArray<Paint> {
    return shown(live(this), "strokes");
  }

  set strokes(paints: ReadonlyArray<Paint>) {
    const state = live(this);
    write(state, "strokes");
    state.strokes = paints.map((paint) => storePaint(state.file, paint));
    noteOverride(state, "strokes");
  }
}

/** Write a layer's fills, an override on an instance or a sublayer (rule 37). */
function writeFills(state: NodeState, paints: ReadonlyArray<Paint> | PluginAPI["mixed"]): void {
  if (paints === MIXED) {
    throw new Error("Cannot write figma.mixed as fills.");
  }
  write(state, "fills");
  state.fills = paints.map((paint) => storePaint(state.file, paint));
  noteOverride(state, "fills");
}

/** A node object, and the guarded node a plugin sees for it. */
type Made = {
  readonly target: FakeBaseNode;
  readonly exposed: Exposed;
};

/** The public node for a node type, behind the guard. */
function makeNode(type: NodeType): Made {
  switch (type) {
    case "DOCUMENT": {
      const target = new FakeDocument();
      // SAFETY: FakeDocument models DocumentNode's members with their types, and the guard
      // throws for every other member.
      return { target, exposed: guard(target, "DocumentNode") as DocumentNode };
    }
    case "PAGE": {
      const target = new FakePage();
      // SAFETY: as above, for PageNode.
      return { target, exposed: guard(target, "PageNode") as PageNode };
    }
    case "FRAME": {
      const target = new FakeFrame();
      // SAFETY: as above, for FrameNode.
      return { target, exposed: guard(target, "FrameNode") as FrameNode };
    }
    case "COMPONENT": {
      const target = new FakeComponent();
      // SAFETY: as above, for ComponentNode.
      return { target, exposed: guard(target, "ComponentNode") as ComponentNode };
    }
    case "COMPONENT_SET": {
      const target = new FakeComponentSet();
      // SAFETY: as above, for ComponentSetNode.
      return { target, exposed: guard(target, "ComponentSetNode") as ComponentSetNode };
    }
    case "INSTANCE": {
      const target = new FakeInstance();
      // SAFETY: as above, for InstanceNode.
      return { target, exposed: guard(target, "InstanceNode") as InstanceNode };
    }
    case "TEXT": {
      const target = new FakeText();
      // SAFETY: as above, for TextNode.
      return { target, exposed: guard(target, "TextNode") as TextNode };
    }
    case "VECTOR": {
      const target = new FakeVector();
      // SAFETY: as above, for VectorNode.
      return { target, exposed: guard(target, "VectorNode") as VectorNode };
    }
  }
}

const WHITE: SolidPaint = {
  type: "SOLID",
  color: { r: 1, g: 1, b: 1 },
  opacity: 1,
  visible: true,
  blendMode: "NORMAL",
};

const BLACK: SolidPaint = { ...WHITE, color: { r: 0, g: 0, b: 0 } };

function createNode(file: FileState, type: NodeType, name: string, id?: string): NodeState {
  const { target, exposed } = makeNode(type);
  file.nextNode += 1;
  const state: NodeState = {
    file,
    id: id ?? `1:${file.nextNode}`,
    type,
    exposed,
    name,
    parent: undefined,
    children: [],
    removed: false,
    sharedData: new Map(),
    loaded: true,
    x: 0,
    y: 0,
    width: type === "TEXT" ? 0 : 100,
    height: type === "TEXT" ? 0 : 100,
    rotation: 0,
    opacity: 1,
    constraints: { horizontal: "MIN", vertical: "MIN" },
    fills: type === "TEXT" ? [BLACK] : type === "VECTOR" || type === "INSTANCE" ? [] : [WHITE],
    strokes: [],
    strokeWeights: { top: 1, right: 1, bottom: 1, left: 1 },
    strokeAlign: "INSIDE",
    strokesIncludedInLayout: false,
    dashPattern: [],
    effects: [],
    radii: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    clipsContent: type === "FRAME",
    itemReverseZIndex: false,
    layoutMode: "NONE",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    itemSpacing: 0,
    counterAxisSpacing: 0,
    limits: { minWidth: null, maxWidth: null, minHeight: null, maxHeight: null },
    layoutGrow: 0,
    layoutAlign: "INHERIT",
    layoutPositioning: "AUTO",
    bindings: new Map(),
    explicitModes: new Map(),
    propertyReferences: null,
    properties: new Map(),
    variantOrder: new Map(),
    main: undefined,
    propertyValues: new Map(),
    exposedInstance: false,
    mirrorOf: undefined,
    overridden: new Set(),
    characters: "",
    styles: [
      {
        font: { family: "Inter", style: "Regular" },
        fontSize: 12,
        lineHeight: { unit: "AUTO" },
        bindings: new Map(),
      },
    ],
    textDecoration: "NONE",
    textDecorationOffset: null,
    letterSpacing: { unit: "PERCENT", value: 0 },
    textAutoResize: "WIDTH_AND_HEIGHT",
    textAlignHorizontal: "LEFT",
    textAlignVertical: "TOP",
    textTruncation: "DISABLED",
    maxLines: null,
    autoRename: type === "TEXT",
  };
  // The guard reads a getter on the object itself, so the object and the guarded node both
  // lead to the state.
  STATES.set(target, state);
  STATES.set(exposed, state);
  file.nodes.set(state.id, state);
  return state;
}

/** One drawn element of an SVG: its layer name and its paints. */
type SvgElement = {
  readonly name: string;
  readonly fill: string;
  readonly stroke: string;
};

const SVG_ROOT = /<svg\b([^>]*)>/;
const UNDRAWN = /<(defs|clipPath|mask)\b[^>]*>[\s\S]*?<\/\1>/g;
const DRAWN = /<(path|circle|rect|ellipse|polygon|polyline|line)\b([^>]*?)\/?>/g;

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes)?.[1];
}

const NAMED_COLORS = new Map([
  ["white", "#ffffff"],
  ["black", "#000000"],
]);

/** The paints an SVG paint attribute draws with: none, or one solid paint. */
function svgPaints(file: FileState, value: string): Paint[] {
  if (value === "none") {
    return [];
  }
  const hex = NAMED_COLORS.get(value.toLowerCase()) ?? value;
  const parsed = Hex.parse(hex);
  if (parsed._tag === "err") {
    throw new Error(`The fake Figma file reads SVG paints in six-digit hex, white or black, not ${value}.`);
  }
  const { r, g, b } = getOrThrow(parsed);
  return [
    storePaint(file, { type: "SOLID", color: { r, g, b }, opacity: 1, visible: true, blendMode: "NORMAL" }),
  ];
}

/** Rule 6: the frame `createNodeFromSvg` makes. */
function drawSvg(file: FileState, svg: string): NodeState {
  const root = SVG_ROOT.exec(svg)?.[1];
  const width = Number(attribute(root ?? "", "width"));
  const height = Number(attribute(root ?? "", "height"));
  if (root === undefined || !(width > 0) || !(height > 0)) {
    throw new Error("The fake Figma file draws only an SVG whose root sets a width and a height.");
  }
  const fill = attribute(root, "fill") ?? "#000000";
  const stroke = attribute(root, "stroke") ?? "none";
  const elements: SvgElement[] = [...svg.replaceAll(UNDRAWN, "").matchAll(DRAWN)].map(
    ([, , attributes = ""]) => ({
      name: attribute(attributes, "id") ?? "Vector",
      fill: attribute(attributes, "fill") ?? fill,
      stroke: attribute(attributes, "stroke") ?? stroke,
    })
  );
  const frame = createNode(file, "FRAME", "svg");
  frame.width = f32(width);
  frame.height = f32(height);
  frame.clipsContent = true;
  frame.fills = [WHITE];
  frame.children = elements.map((element) => {
    const vector = createNode(file, "VECTOR", element.name);
    vector.width = frame.width;
    vector.height = frame.height;
    vector.fills = svgPaints(file, element.fill);
    vector.strokes = svgPaints(file, element.stroke);
    vector.parent = frame;
    return vector;
  });
  placeOnCurrentPage(file, frame);
  write(frame, "create from SVG");
  return frame;
}

function flatten(
  file: FileState,
  nodes: readonly NodeState[],
  parent: NodeState,
  index: number | undefined
): NodeState {
  const [first] = nodes;
  if (first === undefined) {
    throw new Error("flatten needs at least one node.");
  }
  for (const node of nodes) {
    if (node.mirrorOf !== undefined) {
      throw new Error(`Cannot flatten ${node.id}, a layer inside an instance.`);
    }
  }
  const vector = createNode(file, "VECTOR", "Vector");
  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  vector.x = left;
  vector.y = top;
  vector.width = f32(Math.max(...nodes.map((node) => node.x + node.width)) - left);
  vector.height = f32(Math.max(...nodes.map((node) => node.y + node.height)) - top);
  vector.fills = first.fills;
  vector.strokes = first.strokes;
  for (const node of nodes) {
    write(node, "flatten");
    detach(node);
    markRemoved(node);
  }
  insert(parent, vector, index);
  return vector;
}

function combineAsVariants(
  file: FileState,
  components: readonly NodeState[],
  parent: NodeState,
  index: number | undefined
): NodeState {
  if (components.length === 0) {
    throw new Error("combineAsVariants needs at least one component.");
  }
  for (const component of components) {
    if (component.type !== "COMPONENT") {
      throw new Error(
        `combineAsVariants combines only components, and ${component.id} is a ${component.type}.`
      );
    }
  }
  const set = createNode(file, "COMPONENT_SET", "Component Set");
  const left = Math.min(...components.map((component) => component.x));
  const top = Math.min(...components.map((component) => component.y));
  set.x = left;
  set.y = top;
  set.width = f32(Math.max(...components.map((component) => component.x + component.width)) - left);
  set.height = f32(Math.max(...components.map((component) => component.y + component.height)) - top);
  set.clipsContent = true;
  insert(parent, set, index);
  for (const component of components) {
    insert(set, component, undefined);
    component.x = f32(component.x - left);
    component.y = f32(component.y - top);
  }
  write(set, "combine as variants");
  return set;
}

/** The literal a synced value holds, or the alias it names by id. */
function storedValue(
  value: SyncedValue,
  idOf: (collection: string, variable: string) => string
): StoredValue {
  switch (value._tag) {
    case "Alias":
      return { kind: "alias", id: idOf(value.target.collection, value.target.variable) };
    case "Color":
      return { kind: "color", color: storeRgba(value.color) };
    case "Float":
      return { kind: "float", value: f32(value.value) };
    case "String":
      return { kind: "string", value: value.value };
  }
}

/** A synced file's collections, and its variables by id. */
type SeededVariables = {
  readonly collections: readonly CollectionState[];
  readonly variables: ReadonlyMap<string, VariableState>;
};

/** The file's collections and variables, with the ids Figma would give them in this order. */
function seedVariables(collections: readonly CollectionSpec[]): SeededVariables {
  const ids = new Map<string, string>();
  let next = 0;
  const states = collections.map((collection, index): CollectionState => {
    const modes = collection.modes.map((name, mode) => ({ modeId: `${index + 1}:${mode}`, name }));
    const [first] = modes;
    if (first === undefined) {
      throw new Error(`The collection ${collection.name} has no modes.`);
    }
    for (const variable of collection.variables) {
      next += 1;
      ids.set(`${collection.name}/${variable.name}`, `VariableID:1:${next}`);
    }
    return {
      id: `VariableCollectionId:1:${index + 1}`,
      name: collection.name,
      modes,
      defaultModeId: first.modeId,
      variableIds: [],
      exposed: undefined,
    };
  });
  const idOf = (collection: string, variable: string): string => {
    const id = ids.get(`${collection}/${variable}`);
    if (id === undefined) {
      throw new Error(`The synced collections alias ${collection}/${variable}, which they do not hold.`);
    }
    return id;
  };
  const variables = new Map<string, VariableState>();
  collections.forEach((collection, index) => {
    const state = states[index];
    if (state === undefined) {
      throw new Error(`The collection ${collection.name} has no state.`);
    }
    for (const variable of collection.variables) {
      const id = idOf(collection.name, variable.name);
      state.variableIds.push(id);
      const values = new Map<string, StoredValue>();
      for (const mode of state.modes) {
        const value = variable.values.get(mode.name);
        if (value === undefined) {
          throw new Error(`${collection.name}/${variable.name} has no value in ${mode.name}.`);
        }
        values.set(mode.modeId, storedValue(value, idOf));
      }
      variables.set(id, {
        id,
        name: variable.name,
        collection: state,
        resolvedType: variable.type,
        values,
        exposed: undefined,
      });
    }
  });
  return { collections: states, variables };
}

function exposeCollection(collection: CollectionState): VariableCollection {
  if (collection.exposed !== undefined) {
    return collection.exposed;
  }
  const api: Pick<
    VariableCollection,
    "id" | "name" | "remote" | "isExtension" | "modes" | "defaultModeId" | "variableIds"
  > = {
    id: collection.id,
    name: collection.name,
    remote: false,
    isExtension: false,
    modes: collection.modes.map((mode) => ({ ...mode })),
    defaultModeId: collection.defaultModeId,
    variableIds: [...collection.variableIds],
  };
  // SAFETY: the object models the members of a local collection the plugin reads, and the
  // guard throws for every other member.
  const exposed = guard(api, "VariableCollection") as VariableCollection;
  collection.exposed = exposed;
  return exposed;
}

function exposeVariable(file: FileState, variable: VariableState): Variable {
  if (variable.exposed !== undefined) {
    return variable.exposed;
  }
  const api: Pick<
    Variable,
    "id" | "name" | "remote" | "variableCollectionId" | "resolvedType" | "valuesByMode" | "resolveForConsumer"
  > = {
    id: variable.id,
    name: variable.name,
    remote: false,
    variableCollectionId: variable.collection.id,
    resolvedType: variable.resolvedType,
    valuesByMode: Object.fromEntries([...variable.values].map(([mode, value]) => [mode, figmaValue(value)])),
    resolveForConsumer: (consumer) => ({
      value: figmaValue(resolve(file, variable, live(consumer))),
      resolvedType: variable.resolvedType,
    }),
  };
  // SAFETY: the object models the members of a local variable the plugin reads, and the guard
  // throws for every other member.
  const exposed = guard(api, "Variable") as Variable;
  variable.exposed = exposed;
  return exposed;
}

/** Rule 1: a bound paint takes the variable's alpha, in the default modes, as its opacity. */
function bindPaint(file: FileState, paint: SolidPaint, variable: Variable | null): SolidPaint {
  if (variable === null) {
    const { boundVariables: _unbound, ...unbound } = paint;
    return unbound;
  }
  const bound = fileVariable(file, variable);
  requireType(bound, "COLOR", "a paint's color");
  const { r, g, b, a } = resolveColor(file, bound, undefined);
  return { ...paint, color: { r, g, b }, opacity: a, boundVariables: { color: alias(bound.id) } };
}

const EFFECT_FIELD_TYPES = new Map<VariableBindableEffectField, VariableResolvedDataType>([
  ["color", "COLOR"],
  ["radius", "FLOAT"],
  ["spread", "FLOAT"],
  ["offsetX", "FLOAT"],
  ["offsetY", "FLOAT"],
]);

/** Bind a shadow's field. The value stays as written: rule 2 applies when the node stores it. */
function bindEffect(
  file: FileState,
  effect: Effect,
  field: VariableBindableEffectField,
  variable: Variable | null
): Effect {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    throw new Error(`The fake Figma file does not model binding a ${effect.type}.`);
  }
  const { [field]: _previous, ...others } = effect.boundVariables ?? {};
  if (variable === null) {
    return { ...effect, boundVariables: others };
  }
  const bound = fileVariable(file, variable);
  requireType(bound, EFFECT_FIELD_TYPES.get(field) ?? "FLOAT", `a shadow's ${field}`);
  return { ...effect, boundVariables: { ...others, [field]: alias(bound.id) } };
}

/**
 * Whether Figma draws a drop shadow's spread on a node: a frame, component or instance that
 * clips its content and has a visible fill (rule 3).
 *
 * @param node - A node of a fake file.
 * @returns True when the node draws its shadows' spread.
 */
export function drawsShadowSpread(node: SceneNode): boolean {
  const state = live(node);
  return (
    (state.type === "FRAME" || state.type === "COMPONENT" || state.type === "INSTANCE") &&
    state.clipsContent &&
    shown(state, "fills").some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0)
  );
}

/** A node and the layers that hold it, from the document down. */
function lineage(state: NodeState): readonly NodeState[] {
  return state.parent === undefined ? [state] : [...lineage(state.parent), state];
}

/**
 * Whether Figma paints one layer above another (rule 33). A layer paints above the frames that hold
 * it. Of two layers in different children of one frame, the one in the later child paints above,
 * or the one in the earlier child where the frame is an auto layout with `itemReverseZIndex` true.
 *
 * @param upper - A layer of a fake file.
 * @param lower - Another layer of the same file.
 * @returns True when `upper` paints above `lower`.
 */
export function paintsAbove(upper: SceneNode, lower: SceneNode): boolean {
  const above = lineage(live(upper));
  const below = lineage(live(lower));
  const split = above.findIndex((state, index) => below[index] !== state);
  if (split === -1 || split >= below.length) {
    return above.length > below.length;
  }
  const holder = above[split - 1];
  const upperChild = above[split];
  const lowerChild = below[split];
  if (holder === undefined || upperChild === undefined || lowerChild === undefined) {
    throw new Error("The fake Figma file compares only layers of one document.");
  }
  const children = childrenOf(holder);
  const later = children.indexOf(upperChild) > children.indexOf(lowerChild);
  const reversed = holder.layoutMode !== "NONE" && holder.itemReverseZIndex;
  return reversed ? !later : later;
}

function fontUnavailable(file: FileState, font: FontNameInput): boolean {
  return file.unavailableFonts.some(
    (missing) =>
      missing.family === font.family && (missing.style === undefined || missing.style === font.style)
  );
}

/**
 * Make a fake file that a sync has filled with the given collections. It holds one empty page,
 * `Page 1`, which is the current page.
 *
 * @param options - The synced collections and the fonts the machine lacks.
 * @returns The Plugin API over the file and what a test reads beside it.
 */
export function createFakeFigma(options: FakeFigmaOptions): FakeFigma {
  const seeded = seedVariables(options.collections);
  const file: FileState = {
    nextNode: 0,
    nextProperty: 0,
    writes: [],
    nodes: new Map(),
    document: undefined,
    current: undefined,
    loadedFonts: new Set(),
    unavailableFonts: options.unavailableFonts ?? [],
    collections: seeded.collections,
    variables: seeded.variables,
    images: new Set(),
    skipInvisibleInstanceChildren: false,
  };
  const document = createNode(file, "DOCUMENT", "Document", "0:0");
  const firstPage = createNode(file, "PAGE", "Page 1", "0:1");
  document.children = [firstPage];
  firstPage.parent = document;
  file.document = document;
  file.current = firstPage;

  const stateOfParent = (parent: (BaseNode & ChildrenMixin) | undefined): NodeState => {
    if (parent !== undefined) {
      return live(parent);
    }
    if (file.current === undefined) {
      throw new Error("The fake Figma file has no current page.");
    }
    return file.current;
  };

  const variables: Pick<
    VariablesAPI,
    | "getLocalVariableCollectionsAsync"
    | "getLocalVariablesAsync"
    | "getVariableByIdAsync"
    | "getVariableCollectionByIdAsync"
    | "setBoundVariableForPaint"
    | "setBoundVariableForEffect"
  > = {
    getLocalVariableCollectionsAsync: () => Promise.resolve(file.collections.map(exposeCollection)),
    getLocalVariablesAsync: (type) =>
      Promise.resolve(
        [...file.variables.values()]
          .filter((variable) => type === undefined || variable.resolvedType === type)
          .map((variable) => exposeVariable(file, variable))
      ),
    getVariableByIdAsync: (id) => {
      const variable = file.variables.get(id);
      return Promise.resolve(variable === undefined ? null : exposeVariable(file, variable));
    },
    getVariableCollectionByIdAsync: (id) => {
      const collection = file.collections.find((candidate) => candidate.id === id);
      return Promise.resolve(collection === undefined ? null : exposeCollection(collection));
    },
    setBoundVariableForPaint: (paint, _field, variable) => bindPaint(file, paint, variable),
    setBoundVariableForEffect: (effect, field, variable) => bindEffect(file, effect, field, variable),
  };

  const api: Pick<
    PluginAPI,
    | "root"
    | "currentPage"
    | "mixed"
    | "loadFontAsync"
    | "setCurrentPageAsync"
    | "createPage"
    | "createFrame"
    | "createComponent"
    | "createText"
    | "createNodeFromSvg"
    | "combineAsVariants"
    | "flatten"
    | "base64Encode"
    | "base64Decode"
    | "createImage"
    | "getImageByHash"
    | "variables"
    | "skipInvisibleInstanceChildren"
  > = {
    get skipInvisibleInstanceChildren(): boolean {
      return file.skipInvisibleInstanceChildren;
    },
    set skipInvisibleInstanceChildren(value: boolean) {
      file.skipInvisibleInstanceChildren = value;
    },
    get root(): DocumentNode {
      const node = document.exposed;
      if (node.type !== "DOCUMENT") {
        throw new Error("The fake Figma file's root is no document.");
      }
      return node;
    },
    get currentPage(): PageNode {
      if (file.current === undefined) {
        throw new Error("The fake Figma file has no current page.");
      }
      return pageOf(file.current);
    },
    mixed: MIXED,
    loadFontAsync: (font) => {
      if (fontUnavailable(file, font)) {
        return Promise.reject(new Error(`The font "${font.family} ${font.style ?? ""}" is not available.`));
      }
      file.loadedFonts.add(fontKey(font));
      return Promise.resolve();
    },
    setCurrentPageAsync: (page) => {
      const state = live(page);
      if (state.type !== "PAGE") {
        throw new Error(`${state.id} is a ${state.type}, not a page.`);
      }
      write(state, "show the page");
      state.loaded = true;
      file.current = state;
      return Promise.resolve();
    },
    createPage: () => {
      const page = createNode(file, "PAGE", `Page ${document.children.length + 1}`);
      document.children.push(page);
      page.parent = document;
      write(page, "create a page");
      return pageOf(page);
    },
    createFrame: () => {
      const frame = createNode(file, "FRAME", "Frame");
      placeOnCurrentPage(file, frame);
      write(frame, "create a frame");
      const node = frame.exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${frame.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    createComponent: () => {
      const component = createNode(file, "COMPONENT", "Component");
      placeOnCurrentPage(file, component);
      write(component, "create a component");
      return componentOf(component);
    },
    createText: () => {
      const text = createNode(file, "TEXT", "");
      placeOnCurrentPage(file, text);
      write(text, "create a text layer");
      const node = text.exposed;
      if (node.type !== "TEXT") {
        throw new Error(`${text.id} is a ${node.type}, not a text layer.`);
      }
      return node;
    },
    createNodeFromSvg: (svg) => {
      const node = drawSvg(file, svg).exposed;
      if (node.type !== "FRAME") {
        throw new Error(`${node.id} is a ${node.type}, not a frame.`);
      }
      return node;
    },
    combineAsVariants: (nodes, parent, index) => {
      const set = combineAsVariants(file, nodes.map(live), live(parent), index).exposed;
      if (set.type !== "COMPONENT_SET") {
        throw new Error(`${set.id} is a ${set.type}, not a component set.`);
      }
      return set;
    },
    flatten: (nodes, parent, index) => {
      const vector = flatten(file, nodes.map(live), stateOfParent(parent), index).exposed;
      if (vector.type !== "VECTOR") {
        throw new Error(`${vector.id} is a ${vector.type}, not a vector.`);
      }
      return vector;
    },
    base64Encode,
    base64Decode,
    createImage: (bytes) => createImage(file, bytes),
    getImageByHash: (hash) => (file.images.has(hash) ? exposeImage(hash) : null),
    // SAFETY: the object models the variable calls the plugin makes, and the guard throws for
    // every other member.
    variables: guard(variables, "figma.variables") as VariablesAPI,
  };

  return {
    // SAFETY: the object models the Plugin API calls the plugin makes, and the guard throws for
    // every other member.
    figma: guard(api, "figma") as PluginAPI,
    writes: file.writes,
    reopen: (reopened) => {
      for (const page of document.children) {
        page.loaded = page === file.current;
      }
      file.loadedFonts.clear();
      file.unavailableFonts = reopened?.unavailableFonts ?? file.unavailableFonts;
      file.skipInvisibleInstanceChildren = false;
      // A new run reads every instance at its main component's size (rule 32), a nested one before
      // the instances that show it, so the settling repeats until no size moves.
      const standing = [...file.nodes.values()].filter((node) => !node.removed);
      for (let pass = 0; pass <= standing.length; pass += 1) {
        const moved = standing.filter((node) => {
          const { width, height } = node;
          settled(node);
          return node.width !== width || node.height !== height;
        });
        if (moved.length === 0) {
          break;
        }
      }
    },
    variable: (collection, name) => {
      const found = [...file.variables.values()].find(
        (variable) => variable.collection.name === collection && variable.name === name
      );
      if (found === undefined) {
        throw new Error(`The fake Figma file holds no variable ${collection}/${name}.`);
      }
      return exposeVariable(file, found);
    },
  };
}
