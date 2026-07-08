// The sheet model. Raw cell text lives in a Map<CellId, string>; everything
// else — computed values, undo, persistence, cross-tab sync — is a fold or a
// mirror of the one action stream (see App.tsx). This module is pure.

import {
  parseFormula,
  evaluate,
  refsOf,
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
      // a column formula (=A#*B#) computes in its own row when read directly
      const body = src.includes("#")
        ? src.slice(1).replaceAll("#", rowOf(id))
        : src.slice(1);
      const expr = parsed(body);
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

  // Column formulas: "=A#*B#" typed anywhere in a column applies to every
  // row (# = the row number). Rows whose referenced cells are all empty stay
  // empty — no phantom zeros. An explicit cell value always wins.
  for (const [id, src] of raw) {
    if (!src.startsWith("=") || !src.includes("#")) continue;
    const col = /^[A-Z]+/.exec(id)![0];
    for (let r = 1; r <= ROWS; r++) {
      const target = `${col}${r}`;
      if (raw.has(target)) continue;
      const body = src.slice(1).replaceAll("#", String(r));
      const expr = parsed(body);
      if (expr instanceof FormulaError) continue;
      if (!refsOf(expr).some((ref) => raw.has(ref))) continue;
      try {
        done.set(
          target,
          evaluate(expr, (ref) => {
            const v = compute(ref);
            return typeof v === "number" ? v : 0;
          }),
        );
      } catch (err) {
        done.set(target, err instanceof FormulaError ? err.code : "#ERR!");
      }
    }
  }
  return done;
}

const rowOf = (id: CellId): string => /[0-9]+$/.exec(id)![0];

// ── cell formatting ─────────────────────────────────────────────────────────

/** Формат → Числа: how a value is rendered (values stay untouched). */
export type NumberFormat =
  | "plain" // Обычный текст: no number interpretation at all
  | "number" // 1 000,12
  | "percent" // 12,34%
  | "scientific" // 1,01E+03
  | "financial" // (1 000,12)
  | "currency" // ₽1 000,12
  | "currency0" // ₽1 000
  | "date" // 26.09.2008
  | "time"; // 15:59:00

export interface CellFormat {
  b?: boolean; // bold
  i?: boolean; // italic
  u?: boolean; // underline
  s?: boolean; // strikethrough
  al?: "left" | "center" | "right";
  fg?: string; // text color
  bg?: string; // fill color
  fs?: number; // font size, px
  nf?: NumberFormat;
  dec?: number; // decimal places
  wr?: boolean; // wrap text
  bt?: boolean; // borders, per edge
  bb?: boolean;
  bl?: boolean;
  br?: boolean;
}
export type Formats = Map<CellId, CellFormat>;

/** The patch that unsets every format property (Очистить форматирование). */
export const CLEAR_FORMAT: Partial<CellFormat> = {
  b: undefined,
  i: undefined,
  u: undefined,
  s: undefined,
  al: undefined,
  fg: undefined,
  bg: undefined,
  fs: undefined,
  nf: undefined,
  dec: undefined,
  wr: undefined,
  bt: undefined,
  bb: undefined,
  bl: undefined,
  br: undefined,
};

/** A format as an inline css string (empty for no format). */
export function styleOf(f: CellFormat | undefined): string {
  if (!f) return "";
  const out: string[] = [];
  if (f.b) out.push("font-weight:700");
  if (f.i) out.push("font-style:italic");
  if (f.u || f.s) {
    const deco = [f.u && "underline", f.s && "line-through"]
      .filter(Boolean)
      .join(" ");
    out.push(`text-decoration:${deco}`);
  }
  if (f.al) out.push(`text-align:${f.al}`);
  if (f.fg) out.push(`color:${f.fg}`);
  if (f.bg) out.push(`background:${f.bg}`);
  if (f.fs) out.push(`font-size:${f.fs}px`);
  const B = "1px solid #202124";
  if (f.bt) out.push(`border-top:${B}`);
  if (f.bb) out.push(`border-bottom:${B}`);
  if (f.bl) out.push(`border-left:${B}`);
  if (f.br) out.push(`border-right:${B}`);
  if (f.wr) out.push("white-space:normal;overflow:visible;line-height:1.3");
  return out.join(";");
}

/** Does this computed value look like a hyperlink? */
export const isUrl = (v: Computed | undefined): boolean =>
  typeof v === "string" && /^https?:\/\/\S+$/i.test(v);

// 1234567.5 → "1 234 567,50" (ru style: NBSP groups, comma decimals)
const ruNum = (n: number, dec: number): string => {
  const [int, frac] = Math.abs(n).toFixed(dec).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return (n < 0 ? "-" : "") + grouped + (frac ? "," + frac : "");
};

// "26.09.2008" | ISO-ish strings → Date (dates-as-text is all we store)
const parseDateish = (v: Computed | undefined): Date | null => {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v.trim());
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1]) : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const dd = (n: number) => String(n).padStart(2, "0");
export const dateLabel = (d: Date): string =>
  `${dd(d.getDate())}.${dd(d.getMonth() + 1)}.${d.getFullYear()}`;

/** How a computed value is shown, number format applied. */
export function display(
  v: Computed | undefined,
  f: CellFormat | undefined,
): string {
  if (f?.nf === "date" || f?.nf === "time") {
    const d = parseDateish(v);
    if (!d) return format(v);
    return f.nf === "date"
      ? dateLabel(d)
      : `${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
  }
  if (typeof v !== "number") return format(v);
  if (f?.nf === "plain") return String(v);
  if (f?.nf === "percent") {
    const n = v * 100;
    return (f.dec !== undefined ? n.toFixed(f.dec) : format(n)) + "%";
  }
  if (f?.nf === "number") return ruNum(v, f.dec ?? 2);
  if (f?.nf === "currency") return "₽" + ruNum(v, f.dec ?? 2);
  if (f?.nf === "currency0") return "₽" + ruNum(v, 0);
  if (f?.nf === "financial") {
    const s = ruNum(Math.abs(v), f.dec ?? 2);
    return v < 0 ? `(${s})` : s;
  }
  if (f?.nf === "scientific") {
    const [m, e] = v.toExponential(f.dec ?? 2).split("e");
    const sign = e.startsWith("-") ? "-" : "+";
    const exp = e.replace(/^[+-]/, "").padStart(2, "0");
    return `${m.replace(".", ",")}E${sign}${exp}`;
  }
  if (f?.dec !== undefined) return v.toFixed(f.dec);
  return format(v);
}

// ── actions and the reducer ─────────────────────────────────────────────────

import type { ColumnKind, SelectOption, Table, TableFmt } from "./tables.js";
import {
  insertColumnRight,
  removeColumn,
  sortByColumn,
  withKind,
} from "./tableOps.js";

export type Action =
  | { type: "edit"; id: CellId; raw: string }
  | { type: "fill"; ids: CellId[]; raw: string }
  | { type: "editCells"; entries: Array<[CellId, string]> }
  | { type: "clearRange"; ids: CellId[] }
  | { type: "format"; ids: CellId[]; patch: Partial<CellFormat> }
  | { type: "formatCells"; entries: Array<[CellId, Partial<CellFormat>]> }
  | { type: "addTable"; table: Table }
  | { type: "addTableRows"; id: string; count: number }
  | { type: "renameTable"; id: string; name: string }
  | { type: "setTableColor"; id: string; color: string }
  | { type: "setTableFormat"; id: string; patch: Partial<TableFmt> }
  | { type: "removeTable"; id: string }
  | { type: "setColumnKind"; id: string; at: number; kind: ColumnKind }
  | {
      type: "setColumnOptions";
      id: string;
      at: number;
      options: SelectOption[];
    }
  | { type: "insertTableColumn"; id: string; at: number }
  | { type: "removeTableColumn"; id: string; at: number }
  | { type: "sortTable"; id: string; at: number; dir: "asc" | "desc" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; cells: Raw; formats: Formats; tables?: Table[] };

interface Snap {
  cells: Raw;
  formats: Formats;
  tables: Table[];
}

export interface SheetState {
  cells: Raw;
  formats: Formats;
  tables: Table[];
  past: Snap[];
  future: Snap[];
}

export const emptySheet = (
  cells: Raw = new Map(),
  formats: Formats = new Map(),
  tables: Table[] = [],
): SheetState => ({ cells, formats, tables, past: [], future: [] });

const HISTORY_LIMIT = 100;

function mergePatch(
  formats: Formats,
  id: CellId,
  patch: Partial<CellFormat>,
): void {
  const merged: CellFormat = { ...formats.get(id) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === false) {
      delete merged[k as keyof CellFormat];
    } else {
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  if (Object.keys(merged).length === 0) formats.delete(id);
  else formats.set(id, merged);
}

const snap = (s: SheetState): Snap => ({
  cells: s.cells,
  formats: s.formats,
  tables: s.tables,
});

const push = (s: SheetState, next: Partial<Snap>): SheetState => ({
  cells: next.cells ?? s.cells,
  formats: next.formats ?? s.formats,
  tables: next.tables ?? s.tables,
  past: [...s.past.slice(-HISTORY_LIMIT + 1), snap(s)],
  future: [],
});

export function reduce(a: Action, s: SheetState): SheetState {
  switch (a.type) {
    case "edit": {
      const cells = new Map(s.cells);
      if (a.raw === "") cells.delete(a.id);
      else cells.set(a.id, a.raw);
      return push(s, { cells });
    }
    case "fill": {
      // one action → one history snapshot → one Ctrl+Z
      const cells = new Map(s.cells);
      for (const id of a.ids) {
        if (a.raw === "") cells.delete(id);
        else cells.set(id, a.raw);
      }
      return push(s, { cells });
    }
    case "editCells": {
      // the fill handle's write: many raws, ONE history snapshot
      const cells = new Map(s.cells);
      for (const [id, raw] of a.entries) {
        if (raw === "") cells.delete(id);
        else cells.set(id, raw);
      }
      return push(s, { cells });
    }
    case "clearRange": {
      const cells = new Map(s.cells);
      for (const id of a.ids) cells.delete(id);
      return push(s, { cells });
    }
    case "format": {
      const formats = new Map(s.formats);
      for (const id of a.ids) mergePatch(formats, id, a.patch);
      return push(s, { formats });
    }
    case "formatCells": {
      const formats = new Map(s.formats);
      for (const [id, patch] of a.entries) mergePatch(formats, id, patch);
      return push(s, { formats });
    }
    case "addTable":
      return push(s, { tables: [...s.tables, a.table] });
    case "addTableRows":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id ? { ...t, rows: t.rows + a.count } : t,
        ),
      });
    case "setTableFormat":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id ? { ...t, fmt: { ...t.fmt, ...a.patch } } : t,
        ),
      });
    case "renameTable":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id ? { ...t, name: a.name } : t,
        ),
      });
    case "setTableColor":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id ? { ...t, headerColor: a.color } : t,
        ),
      });
    case "removeTable":
      return push(s, { tables: s.tables.filter((t) => t.id !== a.id) });
    case "setColumnKind":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id ? withKind(t, a.at, a.kind) : t,
        ),
      });
    case "setColumnOptions":
      return push(s, {
        tables: s.tables.map((t) =>
          t.id === a.id
            ? {
                ...t,
                columns: t.columns.map((col, i) =>
                  i === a.at ? { ...col, options: a.options } : col,
                ),
              }
            : t,
        ),
      });
    case "insertTableColumn": {
      const t = s.tables.find((x) => x.id === a.id);
      if (!t) return s;
      const res = insertColumnRight(t, s.cells, a.at);
      return push(s, {
        cells: res.cells,
        tables: s.tables.map((x) => (x.id === a.id ? res.table : x)),
      });
    }
    case "removeTableColumn": {
      const t = s.tables.find((x) => x.id === a.id);
      if (!t) return s;
      const res = removeColumn(t, s.cells, a.at);
      return push(s, {
        cells: res.cells,
        tables: s.tables.map((x) => (x.id === a.id ? res.table : x)),
      });
    }
    case "sortTable": {
      const t = s.tables.find((x) => x.id === a.id);
      if (!t) return s;
      return push(s, { cells: sortByColumn(t, s.cells, a.at, a.dir) });
    }
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future],
      };
    }
    case "redo": {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { ...next, past: [...s.past, snap(s)], future: rest };
    }
    case "replace":
      // cross-tab sync: adopt the other tab's sheet, keep local history
      return {
        ...s,
        cells: a.cells,
        formats: a.formats,
        tables: a.tables ?? s.tables,
      };
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

export interface Pos {
  c: number;
  r: number;
}

export interface Rect {
  c1: number;
  c2: number;
  r1: number;
  r2: number;
}

export const rectOf = (a: Pos, b: Pos): Rect => ({
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

/** The used rectangle of computed values as CSV (comma, CRLF, quoted). */
export function toCsv(computed: Map<CellId, Computed>): string {
  let maxC = 0;
  let maxR = 0;
  const at = new Map<string, Computed>();
  for (const [id, v] of computed) {
    const m = /^([A-Z]+)([0-9]+)$/.exec(id)!;
    const c = [...m[1]].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
    const r = Number(m[2]);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
    at.set(`${c}:${r}`, v);
  }
  const quote = (s: string) =>
    /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  const lines: string[] = [];
  for (let r = 1; r <= maxR; r++) {
    const row: string[] = [];
    for (let c = 1; c <= maxC; c++)
      row.push(quote(format(at.get(`${c}:${r}`))));
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}
