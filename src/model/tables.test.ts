import { describe, test, expect } from "vitest";
import {
  TEMPLATES,
  presentationOf,
  tableAt,
  instantiate,
  type Table,
} from "./tables.js";
import { reduce, emptySheet } from "./sheet.js";

const users = TEMPLATES.find((t) => t.name === "Пользователи")!;

describe("templates and presentation", () => {
  test("instantiate stamps a template at an anchor", () => {
    const t = instantiate(users, { c: 1, r: 2 }, "t1");
    expect(t.anchor).toEqual({ c: 1, r: 2 });
    expect(t.columns.length).toBeGreaterThan(2);
    expect(t.rows).toBeGreaterThan(0);
  });

  test("presentationOf maps header and typed cells", () => {
    const t = instantiate(users, { c: 0, r: 0 }, "t1");
    const p = presentationOf([t]);

    const head = p.get("A1"); // header band at the anchor row
    expect(head?.kind).toBe("header");
    if (head?.kind === "header") expect(head.label).toBe("Имя");

    const statusCol = t.columns.findIndex((c) => c.kind === "select");
    const cellId = `${String.fromCharCode(65 + statusCol)}2`; // first data row
    const cell = p.get(cellId);
    expect(cell?.kind).toBe("select");
    if (cell?.kind === "select") {
      expect(cell.options.map((o) => o.label)).toContain("В отпуске");
    }
  });

  test("tableAt finds the table containing a position", () => {
    const t = instantiate(users, { c: 2, r: 3 }, "t1");
    expect(tableAt([t], { c: 2, r: 3 })?.id).toBe("t1");
    expect(tableAt([t], { c: 2, r: 3 + t.rows })?.id).toBe("t1"); // last row
    expect(tableAt([t], { c: 0, r: 0 })).toBeUndefined();
  });
});

describe("tables in the reducer", () => {
  test("addTable participates in undo like everything else", () => {
    const t = instantiate(users, { c: 0, r: 0 }, "t1");
    const s1 = reduce({ type: "addTable", table: t }, emptySheet());
    expect(s1.tables).toHaveLength(1);

    const undone = reduce({ type: "undo" }, s1);
    expect(undone.tables).toHaveLength(0);
    expect(reduce({ type: "redo" }, undone).tables).toHaveLength(1);
  });

  test("addTableRows grows a table as one undo step", () => {
    const t: Table = instantiate(users, { c: 0, r: 0 }, "t1");
    const s1 = reduce({ type: "addTable", table: t }, emptySheet());
    const s2 = reduce({ type: "addTableRows", id: "t1", count: 10 }, s1);
    expect(s2.tables[0].rows).toBe(t.rows + 10);
    expect(reduce({ type: "undo" }, s2).tables[0].rows).toBe(t.rows);
  });
});

describe("table formatting (Форматирование таблицы)", () => {
  test("setTableFormat merges the patch and participates in undo", () => {
    const t = instantiate(users, { c: 0, r: 0 }, "t1");
    const s1 = reduce({ type: "addTable", table: t }, emptySheet());
    const s2 = reduce(
      { type: "setTableFormat", id: "t1", patch: { banded: true } },
      s1,
    );
    expect(s2.tables[0].fmt?.banded).toBe(true);
    const s3 = reduce(
      { type: "setTableFormat", id: "t1", patch: { grid: false } },
      s2,
    );
    expect(s3.tables[0].fmt).toEqual({ banded: true, grid: false });
    expect(reduce({ type: "undo" }, s3).tables[0].fmt).toEqual({
      banded: true,
    });
  });

  test("banding decorates every second data row — text columns included", () => {
    const t: Table = {
      ...instantiate(users, { c: 0, r: 0 }, "t1"),
      fmt: { banded: true },
    };
    const p = presentationOf([t]);
    expect(p.get("B2")?.kind).toBe("text"); // «Роль» now carries presentation
    expect((p.get("B2") as { deco?: string }).deco ?? "").toBe("");
    expect((p.get("B3") as { deco?: string }).deco).toContain(
      "background:#f1f3f4",
    );
  });

  test("gridlines off makes cell borders transparent via deco", () => {
    const t: Table = {
      ...instantiate(users, { c: 0, r: 0 }, "t1"),
      fmt: { grid: false },
    };
    const p = presentationOf([t]);
    expect((p.get("A2") as { deco?: string }).deco).toContain(
      "border-right-color:transparent",
    );
  });
});
