const tsExtensions = [".ts", ".tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("node:") || specifier.startsWith("data:")) {
    return nextResolve(specifier, context);
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const hasKnownExtension = /\.[a-zA-Z0-9]+$/.test(specifier);
    if (!hasKnownExtension) {
      for (const extension of tsExtensions) {
        try {
          return await nextResolve(`${specifier}${extension}`, context);
        } catch {
          // Try the next extension.
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
