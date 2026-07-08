// Structured tables — Sheets-style typed regions over the grid. A table is
// META over normal cells: values still live in the cells map (so editing,
// formulas, undo, persistence and sync need no new machinery); the table
// contributes presentation — a header band and typed columns.

import { cellId, type CellId, type Pos } from "./sheet.js";

export type ColumnKind =
  "text" | "person" | "select" | "date" | "number" | "percent" | "notes";

export interface SelectOption {
  label: string;
  color: string; // chip background
}

export interface TableColumn {
  name: string;
  kind: ColumnKind;
  options?: SelectOption[]; // for kind === "select"
}

/** Форматирование таблицы: presentation toggles, defaults = Sheets. */
export interface TableFmt {
  grid?: boolean; // линии сетки (default true)
  banded?: boolean; // чередующиеся цвета
  compact?: boolean; // компактный вид
  footer?: boolean; // нижний колонтитул
}

export interface Table {
  headerColor?: string;
  id: string;
  name: string;
  anchor: Pos; // the header band row
  columns: TableColumn[];
  rows: number; // data rows below the header
  fmt?: TableFmt;
}

export interface Template {
  name: string;
  icon: "grid" | "tasks" | "chart" | "person";
  columns: TableColumn[];
  rows: number;
}

const STATUS_GREEN = "#d4edbc";
const STATUS_YELLOW = "#ffe5a0";
const STATUS_BLUE = "#bfe1f6";
const STATUS_RED = "#ffcfc9";
const STATUS_GRAY = "#e6e6e6";

export const TEMPLATES: Template[] = [
  {
    name: "Пустая таблица",
    icon: "grid",
    columns: [
      { name: "Столбец 1", kind: "text" },
      { name: "Столбец 2", kind: "text" },
      { name: "Столбец 3", kind: "select", options: [] },
    ],
    rows: 5,
  },
  {
    name: "Задачи",
    icon: "tasks",
    columns: [
      { name: "Задача", kind: "text" },
      { name: "Ответственный", kind: "person" },
      {
        name: "Статус",
        kind: "select",
        options: [
          { label: "Не начато", color: STATUS_GRAY },
          { label: "В работе", color: STATUS_YELLOW },
          { label: "Готово", color: STATUS_GREEN },
        ],
      },
      { name: "Срок", kind: "date" },
      {
        name: "Приоритет",
        kind: "select",
        options: [
          { label: "Низкий", color: STATUS_BLUE },
          { label: "Средний", color: STATUS_YELLOW },
          { label: "Высокий", color: STATUS_RED },
        ],
      },
    ],
    rows: 6,
  },
  {
    name: "Пользователи",
    icon: "person",
    columns: [
      { name: "Имя", kind: "person" },
      { name: "Роль", kind: "text" },
      {
        name: "Статус",
        kind: "select",
        options: [
          { label: "Полный рабочий день", color: STATUS_GREEN },
          { label: "Неполный день", color: STATUS_YELLOW },
          { label: "В отпуске", color: STATUS_BLUE },
        ],
      },
      { name: "Часы в неделю", kind: "number" },
      { name: "Вместимость", kind: "percent" },
      { name: "Примечания", kind: "notes" },
    ],
    rows: 6,
  },
  {
    name: "Кандидаты",
    icon: "person",
    columns: [
      { name: "Кандидат", kind: "person" },
      { name: "Позиция", kind: "text" },
      {
        name: "Этап",
        kind: "select",
        options: [
          { label: "Скрининг", color: STATUS_BLUE },
          { label: "Интервью", color: STATUS_YELLOW },
          { label: "Оффер", color: STATUS_GREEN },
          { label: "Отказ", color: STATUS_RED },
        ],
      },
      { name: "Оценка", kind: "number" },
      { name: "Примечания", kind: "notes" },
    ],
    rows: 5,
  },
  {
    name: "Трекер контента",
    icon: "chart",
    columns: [
      { name: "Материал", kind: "text" },
      { name: "Автор", kind: "person" },
      {
        name: "Стадия",
        kind: "select",
        options: [
          { label: "Черновик", color: STATUS_GRAY },
          { label: "Ревью", color: STATUS_YELLOW },
          { label: "Опубликовано", color: STATUS_GREEN },
        ],
      },
      { name: "Просмотры", kind: "number" },
    ],
    rows: 5,
  },
];

export const instantiate = (tpl: Template, anchor: Pos, id: string): Table => ({
  id,
  name: tpl.name,
  anchor,
  columns: tpl.columns,
  rows: tpl.rows,
});

// ── presentation: what a table means for individual cells ──────────────────

export type CellPresentation =
  | { kind: "header"; label: string; colKind: ColumnKind; color: string }
  | { kind: "text"; deco?: string }
  | { kind: "select"; options: SelectOption[]; deco?: string }
  | { kind: "person"; deco?: string }
  | { kind: "date"; deco?: string }
  | { kind: "number"; deco?: string }
  | { kind: "percent"; deco?: string }
  | { kind: "notes"; deco?: string };

export function presentationOf(tables: Table[]): Map<CellId, CellPresentation> {
  const out = new Map<CellId, CellPresentation>();
  for (const t of tables) {
    // «Форматирование таблицы» → an inline-css decoration per data row
    const deco = (dr: number): string => {
      let s = "";
      if (t.fmt?.banded && dr % 2 === 0) s += "background:#f1f3f4;";
      if (t.fmt?.grid === false)
        s += "border-right-color:transparent;border-bottom-color:transparent;";
      if (t.fmt?.compact) s += "padding-top:1px;font-size:12px;";
      return s;
    };
    t.columns.forEach((col, i) => {
      const c = t.anchor.c + i;
      out.set(cellId(c, t.anchor.r), {
        kind: "header",
        label: col.name,
        colKind: col.kind,
        color: t.headerColor ?? "#3d5a45",
      });
      for (let dr = 1; dr <= t.rows; dr++) {
        const id = cellId(c, t.anchor.r + dr);
        const d = deco(dr) || undefined;
        if (col.kind === "select") {
          out.set(id, { kind: "select", options: col.options ?? [], deco: d });
        } else {
          out.set(id, { kind: col.kind, deco: d });
        }
      }
    });
  }
  return out;
}

/** The table whose region (header + data rows) contains `p`, if any. */
export const tableAt = (tables: Table[], p: Pos): Table | undefined =>
  tables.find(
    (t) =>
      p.c >= t.anchor.c &&
      p.c < t.anchor.c + t.columns.length &&
      p.r >= t.anchor.r &&
      p.r <= t.anchor.r + t.rows,
  );

/** Chip color for a select cell's current value. */
export const optionColor = (
  options: SelectOption[],
  value: string,
): string | undefined => options.find((o) => o.label === value)?.color;
