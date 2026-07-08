import { describe, test, expect } from "vitest";
import { insertColumnRight, removeColumn, sortByColumn } from "./tableOps.js";
import { instantiate, TEMPLATES } from "./tables.js";
import { reduce, emptySheet } from "./sheet.js";

const users = TEMPLATES.find((t) => t.name === "Пользователи")!;
const raw = (o: Record<string, string>) => new Map(Object.entries(o));

// A2 anchor: header at row 2 (index r=1), data rows 3..
const T = instantiate(users, { c: 0, r: 1 }, "t1");

describe("insertColumnRight", () => {
  test("adds a column after `at` and shifts data right", () => {
    const cells = raw({ A3: "Аня", B3: "Дизайн", C3: "В отпуске" });
    const { table, cells: next } = insertColumnRight(T, cells, 0);
    expect(table.columns[1].name).toMatch(/Столбец/);
    expect(table.columns).toHaveLength(T.columns.length + 1);
    // data right of «Имя» moved one column right
    expect(next.get("B3")).toBeUndefined();
    expect(next.get("C3")).toBe("Дизайн");
    expect(next.get("D3")).toBe("В отпуске");
    expect(next.get("A3")).toBe("Аня"); // untouched
  });
});

describe("removeColumn", () => {
  test("drops the column and shifts data left", () => {
    const cells = raw({ A3: "Аня", B3: "Дизайн", C3: "В отпуске" });
    const { table, cells: next } = removeColumn(T, cells, 1); // remove «Роль»
    expect(table.columns).toHaveLength(T.columns.length - 1);
    expect(next.get("B3")).toBe("В отпуске"); // shifted left
    expect(next.get("A3")).toBe("Аня");
  });

  test("the last remaining column cannot be removed", () => {
    const single = { ...T, columns: [T.columns[0]] };
    const cells = raw({});
    expect(removeColumn(single, cells, 0).table.columns).toHaveLength(1);
  });
});

describe("sortByColumn", () => {
  test("reorders whole data rows by the chosen column", () => {
    const cells = raw({
      A3: "Борис",
      B3: "Бэкенд",
      A4: "Аня",
      B4: "Дизайн",
      A5: "Вера",
      B5: "QA",
    });
    const next = sortByColumn(T, cells, 0, "asc");
    expect(next.get("A3")).toBe("Аня");
    expect(next.get("B3")).toBe("Дизайн"); // the row moved together
    expect(next.get("A4")).toBe("Борис");
    expect(next.get("A5")).toBe("Вера");
  });

  test("numbers sort numerically, empty rows sink to the bottom", () => {
    const cells = raw({ D3: "10", D4: "2", A5: "x" });
    const next = sortByColumn(T, cells, 3, "asc"); // «Часы в неделю»
    expect(next.get("D3")).toBe("2");
    expect(next.get("D4")).toBe("10");
    expect(next.get("A5")).toBe("x"); // valueless-in-D rows go last
  });
});

describe("table actions in the reducer", () => {
  const withTable = reduce({ type: "addTable", table: T }, emptySheet());

  test("renameTable / setTableColor / removeTable, all undoable", () => {
    let s = reduce(
      { type: "renameTable", id: "t1", name: "Команда" },
      withTable,
    );
    expect(s.tables[0].name).toBe("Команда");
    s = reduce({ type: "setTableColor", id: "t1", color: "#0b57d0" }, s);
    expect(s.tables[0].headerColor).toBe("#0b57d0");
    s = reduce({ type: "removeTable", id: "t1" }, s);
    expect(s.tables).toHaveLength(0);
    expect(reduce({ type: "undo" }, s).tables).toHaveLength(1);
  });

  test("setColumnKind switches a column to select with default options", () => {
    const s = reduce(
      { type: "setColumnKind", id: "t1", at: 1, kind: "select" },
      withTable,
    );
    expect(s.tables[0].columns[1].kind).toBe("select");
    expect(s.tables[0].columns[1].options!.length).toBeGreaterThan(0);
  });

  test("insert/remove column actions move data as one undo step", () => {
    let s = reduce({ type: "edit", id: "B3", raw: "Дизайн" }, withTable);
    s = reduce({ type: "insertTableColumn", id: "t1", at: 0 }, s);
    expect(s.cells.get("C3")).toBe("Дизайн");
    s = reduce({ type: "undo" }, s);
    expect(s.cells.get("B3")).toBe("Дизайн");
  });

  test("sortTable reorders rows as one undo step", () => {
    let s = reduce({ type: "edit", id: "A3", raw: "Борис" }, withTable);
    s = reduce({ type: "edit", id: "A4", raw: "Аня" }, s);
    s = reduce({ type: "sortTable", id: "t1", at: 0, dir: "asc" }, s);
    expect(s.cells.get("A3")).toBe("Аня");
    expect(reduce({ type: "undo" }, s).cells.get("A3")).toBe("Борис");
  });
});
