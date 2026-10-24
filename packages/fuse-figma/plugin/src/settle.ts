/**
 * Reading instance sizes before the sizes that depend on them. Within one plugin run an instance
 * takes its main component's new size only when it is read, and a frame or component around it sizes
 * from it as it stands. On 2026-10-23 a real file read a preview 816 tall, and 48 once each instance
 * in it was read first (PI), and a component that nests another set's variant kept its old width
 * until the nested instance was read, at every depth (N2). So a layout reads the instances inside a
 * node, the deepest first, before it reads the node's size.
 */

/**
 * Read the width and height of every instance inside a node, each after the instances inside it.
 *
 * @param node - A variant, a preview frame or any layer that holds instances.
 * @returns The sizes read, which the caller discards.
 */
export function settleInstances(node: SceneNode): readonly number[] {
  const sizes: number[] = [];
  const visit = (layer: SceneNode): void => {
    if ("children" in layer) {
      for (const child of layer.children) {
        visit(child);
      }
    }
    if (layer.type === "INSTANCE") {
      sizes.push(layer.width, layer.height);
    }
  };
  visit(node);
  return sizes;
}
