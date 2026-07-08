import { describe, test, expect } from "vitest";
import { fillEntries } from "./fill.js";
import { reduce, emptySheet, type Rect } from "./sheet.js";

const raw = (o: Record<string, string>) => new Map(Object.entries(o));
const rect = (c1: number, r1: number, c2: number, r2: number): Rect => ({
  c1,
  r1,
  c2,
  r2,
});

describe("fillEntries (протягивание за кружок)", () => {
  test("a single value copies down", () => {
    const e = fillEntries(raw({ A1: "5" }), rect(0, 0, 0, 0), rect(0, 1, 0, 2));
    expect(e).toEqual([
      ["A2", "5"],
      ["A3", "5"],
    ]);
  });

  test("two numbers continue the arithmetic series", () => {
    const e = fillEntries(
      raw({ A1: "1", A2: "2" }),
      rect(0, 0, 0, 1),
      rect(0, 2, 0, 4),
    );
    expect(e).toEqual([
      ["A3", "3"],
      ["A4", "4"],
      ["A5", "5"],
    ]);
  });

  test("text copies cyclically", () => {
    const e = fillEntries(
      raw({ A1: "а", A2: "б" }),
      rect(0, 0, 0, 1),
      rect(0, 2, 0, 4),
    );
    expect(e).toEqual([
      ["A3", "а"],
      ["A4", "б"],
      ["A5", "а"],
    ]);
  });

  test("formulas shift row references when filled down", () => {
    const e = fillEntries(
      raw({ B1: "=A1*10" }),
      rect(1, 0, 1, 0),
      rect(1, 1, 1, 2),
    );
    expect(e).toEqual([
      ["B2", "=A2*10"],
      ["B3", "=A3*10"],
    ]);
  });

  test("filling right shifts column references", () => {
    const e = fillEntries(
      raw({ A2: "=A1+1" }),
      rect(0, 1, 0, 1),
      rect(1, 1, 2, 1),
    );
    expect(e).toEqual([
      ["B2", "=B1+1"],
      ["C2", "=C1+1"],
    ]);
  });

  test("column formulas (=A#*B#) are untouched by the shift", () => {
    const e = fillEntries(
      raw({ C1: "=A#*B#" }),
      rect(2, 0, 2, 0),
      rect(2, 1, 2, 1),
    );
    expect(e).toEqual([["C2", "=A#*B#"]]);
  });
});

describe("editCells", () => {
  test("writes many raws as ONE undo step", () => {
    const s = reduce(
      {
        type: "editCells",
        entries: [
          ["A1", "1"],
          ["A2", "2"],
        ],
      },
      emptySheet(),
    );
    expect(s.cells.get("A1")).toBe("1");
    expect(s.cells.get("A2")).toBe("2");
    expect(reduce({ type: "undo" }, s).cells.size).toBe(0);
  });
});
