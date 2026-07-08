import { describe, test, expect } from "vitest";
import { borderPatches, type BorderKind } from "./borders.js";
import { display, styleOf, reduce, emptySheet } from "./sheet.js";

const rect = { c1: 1, c2: 2, r1: 1, r2: 2 }; // B2:C3

const patchFor = (kind: BorderKind, id: string) =>
  borderPatches(rect, kind).find(([i]) => i === id)?.[1];

describe("borderPatches", () => {
  test("all: every cell gets all four edges", () => {
    expect(patchFor("all", "B2")).toEqual({
      bt: true,
      bb: true,
      bl: true,
      br: true,
    });
    expect(borderPatches(rect, "all")).toHaveLength(4);
  });

  test("outer: only the perimeter edges", () => {
    expect(patchFor("outer", "B2")).toEqual({ bt: true, bl: true });
    expect(patchFor("outer", "C3")).toEqual({ bb: true, br: true });
  });

  test("inner: only the edges between cells", () => {
    expect(patchFor("inner", "B2")).toEqual({ bb: true, br: true });
    expect(patchFor("inner", "C3")).toEqual({ bt: true, bl: true });
  });

  test("horizontal: inner horizontal edges only", () => {
    expect(patchFor("horizontal", "B2")).toEqual({ bb: true });
    expect(patchFor("horizontal", "B3")).toEqual({ bt: true });
  });

  test("none clears all four edges on every cell", () => {
    expect(patchFor("none", "C2")).toEqual({
      bt: undefined,
      bb: undefined,
      bl: undefined,
      br: undefined,
    });
  });
});

describe("border/wrap rendering and number formats", () => {
  test("styleOf renders borders and wrap", () => {
    expect(styleOf({ bt: true, br: true })).toBe(
      "border-top:1px solid #202124;border-right:1px solid #202124",
    );
    expect(styleOf({ wr: true })).toContain("white-space:normal");
  });

  test("display: percent and decimal places", () => {
    expect(display(0.25, { nf: "percent" })).toBe("25%");
    expect(display(0.2567, { nf: "percent", dec: 1 })).toBe("25.7%");
    expect(display(3.14159, { dec: 2 })).toBe("3.14");
    expect(display(7, {})).toBe("7");
    expect(display("text", { dec: 2 })).toBe("text");
  });
});

describe("formatCells action", () => {
  test("applies per-cell patches as ONE undo step", () => {
    const s = reduce(
      {
        type: "formatCells",
        entries: [
          ["A1", { bt: true }],
          ["A2", { bb: true }],
        ],
      },
      emptySheet(),
    );
    expect(s.formats.get("A1")).toEqual({ bt: true });
    expect(s.formats.get("A2")).toEqual({ bb: true });
    expect(reduce({ type: "undo" }, s).formats.size).toBe(0);
  });
});
