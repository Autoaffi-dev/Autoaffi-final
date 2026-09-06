import { register } from "node:module";

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:[cm]?[jt]s|json)$/i.test(specifier)
  ) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // Fall through to the original specifier.
    }
  }

  return nextResolve(specifier, context);
}

register(import.meta.url);
