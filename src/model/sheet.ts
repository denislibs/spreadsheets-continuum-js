// The sheet model. Raw cell text lives in a Map<CellId, string>; everything
// else — computed values, undo, persistence, cross-tab sync — is a fold or a
// mirror of the one action stream (see App.tsx). This module is pure.

import {
  parseFormula,
  evaluate,
  FormulaError,
  indexToCol,
  type Expr,
} from "./formula.js";

export const COLS = 26;
export const ROWS = 99;

export type CellId = string; // "A1"
export type Raw = Map<CellId, string>;
export type Computed = number | string; // numbers, text, or "#…" error codes

export const cellId = (col: number, row: number): CellId =>
  `${indexToCol(col + 1)}${row + 1}`;

// ── evaluation: raw text → computed values ──────────────────────────────────

const parseCache = new Map<string, Expr | FormulaError>();

function parsed(src: string): Expr | FormulaError {
  let e = parseCache.get(src);
  if (!e) {
    try {
      e = parseFormula(src);
    } catch (err) {
      e = err instanceof FormulaError ? err : new FormulaError("#ERR!");
    }
    parseCache.set(src, e);
  }
  return e;
}

const asNumber = (raw: string): number | null => {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * Evaluate the whole sheet: recursion with memoization, an in-progress set
 * turning circular chains into "#CYCLE!". Cells referenced in arithmetic
 * contribute their numeric value; text and empties contribute 0.
 */
export function evalSheet(raw: Raw): Map<CellId, Computed> {
  const done = new Map<CellId, Computed>();
  const inProgress = new Set<CellId>();

  const compute = (id: CellId): Computed | undefined => {
    if (done.has(id)) return done.get(id);
    const src = raw.get(id);
    if (src === undefined) return undefined;

    let value: Computed;
    if (src.startsWith("=")) {
      if (inProgress.has(id)) return "#CYCLE!";
      inProgress.add(id);
      const expr = parsed(src.slice(1));
      if (expr instanceof FormulaError) {
        value = expr.code;
      } else {
        try {
          value = evaluate(expr, (ref) => {
            const v = compute(ref);
            if (v === "#CYCLE!") throw new FormulaError("#CYCLE!");
            return typeof v === "number" ? v : 0;
          });
        } catch (err) {
          value = err instanceof FormulaError ? err.code : "#ERR!";
        }
      }
      inProgress.delete(id);
    } else {
      const n = asNumber(src);
      value = n ?? src;
    }
    done.set(id, value);
    return value;
  };

  for (const id of raw.keys()) compute(id);
  return done;
}

// ── actions and the reducer ─────────────────────────────────────────────────

export type Action =
  | { type: "edit"; id: CellId; raw: string }
  | { type: "clearRange"; ids: CellId[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; cells: Raw };

export interface SheetState {
  cells: Raw;
  past: Raw[];
  future: Raw[];
}

export const emptySheet = (cells: Raw = new Map()): SheetState => ({
  cells,
  past: [],
  future: [],
});

const HISTORY_LIMIT = 100;

export function reduce(a: Action, s: SheetState): SheetState {
  switch (a.type) {
    case "edit": {
      const cells = new Map(s.cells);
      if (a.raw === "") cells.delete(a.id);
      else cells.set(a.id, a.raw);
      return {
        cells,
        past: [...s.past.slice(-HISTORY_LIMIT + 1), s.cells],
        future: [],
      };
    }
    case "clearRange": {
      // one action → one history snapshot → one Ctrl+Z
      const cells = new Map(s.cells);
      for (const id of a.ids) cells.delete(id);
      return {
        cells,
        past: [...s.past.slice(-HISTORY_LIMIT + 1), s.cells],
        future: [],
      };
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return {
        cells: prev,
        past: s.past.slice(0, -1),
        future: [s.cells, ...s.future],
      };
    }
    case "redo": {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { cells: next, past: [...s.past, s.cells], future: rest };
    }
    case "replace":
      // cross-tab sync: adopt the other tab's sheet, keep local history
      return { ...s, cells: a.cells };
  }
}

// ── (de)serialization for persistence ───────────────────────────────────────

export const toPlain = (raw: Raw): Record<string, string> =>
  Object.fromEntries(raw);

export const fromPlain = (o: Record<string, string>): Raw =>
  new Map(Object.entries(o));

/** How a computed value is shown in the grid. */
export const format = (v: Computed | undefined): string => {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
};

// ── range selection helpers ─────────────────────────────────────────────────

export interface Rect {
  c1: number;
  c2: number;
  r1: number;
  r2: number;
}

export const rectOf = (
  a: { c: number; r: number },
  b: { c: number; r: number },
): Rect => ({
  c1: Math.min(a.c, b.c),
  c2: Math.max(a.c, b.c),
  r1: Math.min(a.r, b.r),
  r2: Math.max(a.r, b.r),
});

export const inRect = (rect: Rect, c: number, r: number): boolean =>
  c >= rect.c1 && c <= rect.c2 && r >= rect.r1 && r <= rect.r2;

export function idsInRect(rect: Rect): CellId[] {
  const out: CellId[] = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) out.push(cellId(c, r));
  }
  return out;
}
