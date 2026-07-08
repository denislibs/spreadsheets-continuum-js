import { describe, test, expect } from "vitest";
import {
  evalSheet,
  reduce,
  emptySheet,
  toCsv,
  styleOf,
  type SheetState,
} from "./sheet.js";

const raw = (entries: Record<string, string>) =>
  new Map(Object.entries(entries));

describe("evalSheet", () => {
  test("literals: numbers, text, empty", () => {
    const out = evalSheet(raw({ A1: "42", A2: "hello", A3: "  3.5 " }));
    expect(out.get("A1")).toBe(42);
    expect(out.get("A2")).toBe("hello");
    expect(out.get("A3")).toBe(3.5);
    expect(out.get("B1")).toBeUndefined();
  });

  test("formulas see other cells, chains propagate", () => {
    const out = evalSheet(raw({ A1: "2", A2: "=A1*10", A3: "=A2+A1" }));
    expect(out.get("A2")).toBe(20);
    expect(out.get("A3")).toBe(22);
  });

  test("text and empty cells count as 0 in arithmetic", () => {
    const out = evalSheet(raw({ A1: "hi", B1: "=A1+5", C1: "=Z99+1" }));
    expect(out.get("B1")).toBe(5);
    expect(out.get("C1")).toBe(1);
  });

  test("cycles are reported, not looped", () => {
    const out = evalSheet(raw({ A1: "=B1", B1: "=A1" }));
    expect(out.get("A1")).toBe("#CYCLE!");
    expect(out.get("B1")).toBe("#CYCLE!");
  });

  test("a self-reference is a cycle too", () => {
    const out = evalSheet(raw({ A1: "=A1+1" }));
    expect(out.get("A1")).toBe("#CYCLE!");
  });

  test("errors are per-cell codes and don't poison neighbors", () => {
    const out = evalSheet(raw({ A1: "=1/0", A2: "=2+2", A3: "=(" }));
    expect(out.get("A1")).toBe("#DIV/0!");
    expect(out.get("A2")).toBe(4);
    expect(out.get("A3")).toBe("#ERR!");
  });

  test("SUM over a range with holes", () => {
    const out = evalSheet(raw({ A1: "1", A3: "2", B1: "=SUM(A1:A4)" }));
    expect(out.get("B1")).toBe(3);
  });
});

describe("reduce (actions → state)", () => {
  const after = (...actions: Parameters<typeof reduce>[0][]): SheetState =>
    actions.reduce((s, a) => reduce(a, s), emptySheet());

  test("edit writes, empty raw deletes", () => {
    const s = after({ type: "edit", id: "A1", raw: "7" });
    expect(s.cells.get("A1")).toBe("7");
    const s2 = reduce({ type: "edit", id: "A1", raw: "" }, s);
    expect(s2.cells.has("A1")).toBe(false);
  });

  test("undo restores the previous sheet, redo replays it", () => {
    const s = after(
      { type: "edit", id: "A1", raw: "1" },
      { type: "edit", id: "A1", raw: "2" },
    );
    const undone = reduce({ type: "undo" }, s);
    expect(undone.cells.get("A1")).toBe("1");
    const redone = reduce({ type: "redo" }, undone);
    expect(redone.cells.get("A1")).toBe("2");
  });

  test("undo on empty history is a no-op", () => {
    expect(reduce({ type: "undo" }, emptySheet()).cells.size).toBe(0);
  });

  test("a new edit clears the redo branch", () => {
    const s = after(
      { type: "edit", id: "A1", raw: "1" },
      { type: "edit", id: "A1", raw: "2" },
      { type: "undo" },
      { type: "edit", id: "A1", raw: "3" },
    );
    expect(reduce({ type: "redo" }, s).cells.get("A1")).toBe("3"); // no-op
  });

  test("replace swaps the sheet (cross-tab sync) without touching history", () => {
    const s = after(
      { type: "edit", id: "A1", raw: "1" },
      { type: "edit", id: "A1", raw: "2" },
    );
    const replaced = reduce(
      { type: "replace", cells: new Map([["B2", "9"]]), formats: new Map() },
      s,
    );
    expect(replaced.cells.get("B2")).toBe("9");
    expect(replaced.cells.has("A1")).toBe(false);
    // undo steps back to the last LOCAL snapshot, not the remote one
    const undone = reduce({ type: "undo" }, replaced);
    expect(undone.cells.get("A1")).toBe("1");
    expect(undone.cells.has("B2")).toBe(false);
  });
});

describe("column formulas (=A#*B#)", () => {
  test("the template fills every row that has source data", () => {
    const out = evalSheet(
      raw({
        A2: "2",
        B2: "3000",
        A3: "1",
        B3: "1000",
        C2: "=A#*B#",
      }),
    );
    expect(out.get("C2")).toBe(6000);
    expect(out.get("C3")).toBe(1000); // auto-computed — no raw in C3
    expect(out.get("C4")).toBeUndefined(); // empty row → no phantom zeros
  });

  test("a new row picks the column formula up automatically", () => {
    const base = { A2: "2", B2: "3000", C2: "=A#*B#" };
    expect(evalSheet(raw(base)).get("C5")).toBeUndefined();
    const out = evalSheet(raw({ ...base, A5: "5", B5: "2" }));
    expect(out.get("C5")).toBe(10);
  });

  test("an explicit cell value overrides the column formula", () => {
    const out = evalSheet(
      raw({ A2: "2", B2: "10", C2: "=A#*B#", A3: "3", B3: "10", C3: "999" }),
    );
    expect(out.get("C2")).toBe(20);
    expect(out.get("C3")).toBe(999);
  });
});

describe("toCsv", () => {
  test("serializes the used rectangle with quoting", () => {
    const out = evalSheet(raw({ A1: "Кол-во", B1: "3000", A2: 'say "hi"' }));
    const csv = toCsv(out);
    expect(csv.split("\r\n")[0]).toBe("Кол-во,3000");
    expect(csv.split("\r\n")[1]).toBe('"say ""hi""",');
  });
});

describe("formats and fill", () => {
  const after = (...actions: Parameters<typeof reduce>[0][]): SheetState =>
    actions.reduce((s, a) => reduce(a, s), emptySheet());

  test("format merges a patch per cell and participates in undo", () => {
    const s = after(
      { type: "edit", id: "A1", raw: "x" },
      { type: "format", ids: ["A1", "A2"], patch: { b: true } },
      { type: "format", ids: ["A1"], patch: { al: "center" } },
    );
    expect(s.formats.get("A1")).toEqual({ b: true, al: "center" });
    expect(s.formats.get("A2")).toEqual({ b: true });

    const undone = reduce({ type: "undo" }, s);
    expect(undone.formats.get("A1")).toEqual({ b: true }); // one step back
  });

  test("unsetting the last property drops the cell's format entry", () => {
    const s = after(
      { type: "format", ids: ["A1"], patch: { b: true } },
      { type: "format", ids: ["A1"], patch: { b: undefined } },
    );
    expect(s.formats.has("A1")).toBe(false);
  });

  test("fill writes one raw into every cell as ONE undo step", () => {
    const s = after({ type: "fill", ids: ["A1", "A2", "B1"], raw: "7" });
    expect(s.cells.get("A2")).toBe("7");
    expect(s.cells.get("B1")).toBe("7");
    expect(reduce({ type: "undo" }, s).cells.size).toBe(0);
  });

  test("styleOf renders a css string", () => {
    expect(styleOf({ b: true, i: true, al: "right", bg: "#ffff00" })).toBe(
      "font-weight:700;font-style:italic;text-align:right;background:#ffff00",
    );
    expect(styleOf(undefined)).toBe("");
  });
});
