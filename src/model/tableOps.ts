// Structural table operations. Values live in the plain cells map, so
// inserting/removing/sorting columns REALLY moves data — these are pure
// (table, cells) → (table, cells) transforms the reducer applies as single
// history snapshots.

import { cellId, type Raw } from "./sheet.js";
import type { SelectOption, Table, TableColumn, ColumnKind } from "./tables.js";

const at = (t: Table, col: number, dataRow: number) =>
  cellId(t.anchor.c + col, t.anchor.r + dataRow);

/** Insert a new text column to the RIGHT of `colIdx`, shifting data. */
export function insertColumnRight(
  t: Table,
  cells: Raw,
  colIdx: number,
): { table: Table; cells: Raw } {
  const next = new Map(cells);
  // shift data right, rightmost column first
  for (let c = t.columns.length - 1; c > colIdx; c--) {
    for (let r = 1; r <= t.rows; r++) {
      const from = at(t, c, r);
      const to = at(t, c + 1, r);
      const v = next.get(from);
      if (v === undefined) next.delete(to);
      else next.set(to, v);
      next.delete(from);
    }
  }
  const columns: TableColumn[] = [
    ...t.columns.slice(0, colIdx + 1),
    { name: `Столбец ${t.columns.length + 1}`, kind: "text" },
    ...t.columns.slice(colIdx + 1),
  ];
  return { table: { ...t, columns }, cells: next };
}

/** Remove a column, shifting data left. The last column stays. */
export function removeColumn(
  t: Table,
  cells: Raw,
  colIdx: number,
): { table: Table; cells: Raw } {
  if (t.columns.length <= 1) return { table: t, cells };
  const next = new Map(cells);
  for (let c = colIdx; c < t.columns.length - 1; c++) {
    for (let r = 1; r <= t.rows; r++) {
      const from = at(t, c + 1, r);
      const to = at(t, c, r);
      const v = next.get(from);
      if (v === undefined) next.delete(to);
      else next.set(to, v);
      next.delete(from);
    }
  }
  // clear the vacated rightmost column
  for (let r = 1; r <= t.rows; r++) {
    next.delete(at(t, t.columns.length - 1, r));
  }
  const columns = t.columns.filter((_, i) => i !== colIdx);
  return { table: { ...t, columns }, cells: next };
}

/** Sort the table's data rows by a column; empty-key rows sink to the end. */
export function sortByColumn(
  t: Table,
  cells: Raw,
  colIdx: number,
  dir: "asc" | "desc",
): Raw {
  const rows: Array<{
    key: string | undefined;
    values: (string | undefined)[];
  }> = [];
  for (let r = 1; r <= t.rows; r++) {
    rows.push({
      key: cells.get(at(t, colIdx, r)),
      values: t.columns.map((_, c) => cells.get(at(t, c, r))),
    });
  }
  const mul = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (a.key === undefined && b.key === undefined) return 0;
    if (a.key === undefined) return 1; // empties last, either direction
    if (b.key === undefined) return -1;
    const na = Number(a.key);
    const nb = Number(b.key);
    if (Number.isFinite(na) && Number.isFinite(nb)) return (na - nb) * mul;
    return a.key.localeCompare(b.key, "ru") * mul;
  });
  const next = new Map(cells);
  rows.forEach((row, i) => {
    row.values.forEach((v, c) => {
      const id = at(t, c, i + 1);
      if (v === undefined) next.delete(id);
      else next.set(id, v);
    });
  });
  return next;
}

export const DEFAULT_SELECT_OPTIONS: SelectOption[] = [
  { label: "Вариант 1", color: "#d4edbc" },
  { label: "Вариант 2", color: "#ffe5a0" },
  { label: "Вариант 3", color: "#bfe1f6" },
];

export function withKind(t: Table, colIdx: number, kind: ColumnKind): Table {
  const columns = t.columns.map((col, i) =>
    i === colIdx
      ? {
          ...col,
          kind,
          options:
            kind === "select"
              ? (col.options?.length ?? 0) > 0
                ? col.options
                : DEFAULT_SELECT_OPTIONS
              : undefined,
        }
      : col,
  );
  return { ...t, columns };
}
