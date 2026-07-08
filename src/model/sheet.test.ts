import { describe, test, expect } from "vitest";
import { evalSheet, reduce, emptySheet, type SheetState } from "./sheet.js";

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
      { type: "replace", cells: new Map([["B2", "9"]]) },
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
