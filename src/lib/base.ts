// GitHub Pages serves the app under /<repo>/ — Vite knows the base at build
// time. Routes get the base segments as wrapping layouts; links go through
// withBase(). Locally BASE_URL is "/" and both are no-ops.

export const BASE = import.meta.env.BASE_URL; // "/" or "/<repo>/"

export const withBase = (path: string): string =>
  BASE.replace(/\/$/, "") + path;

/** Wrap route definitions in the base path segments (none locally). */
export function underBase<T extends { path: string }>(
  routes: Array<T | { path: string; children: unknown[] }>,
): Array<T | { path: string; children: unknown[] }> {
  const segs = BASE.split("/").filter(Boolean);
  let out = routes;
  for (const seg of [...segs].reverse()) {
    out = [{ path: seg, children: out }];
  }
  return out;
}
