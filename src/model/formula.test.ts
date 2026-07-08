import { describe, test, expect } from "vitest";
import { parseFormula, refsOf, evaluate, FormulaError } from "./formula.js";

const get = (env: Record<string, number>) => (id: string) => env[id] ?? 0;

const run = (src: string, env: Record<string, number> = {}) =>
  evaluate(parseFormula(src), get(env));

describe("arithmetic", () => {
  test("literals and precedence", () => {
    expect(run("1+2*3")).toBe(7);
    expect(run("(1+2)*3")).toBe(9);
    expect(run("10-2-3")).toBe(5); // left-assoc
    expect(run("8/2/2")).toBe(2);
    expect(run("1.5+0.25")).toBe(1.75);
  });

  test("unary minus", () => {
    expect(run("-3+5")).toBe(2);
    expect(run("2*-3")).toBe(-6);
    expect(run("-(1+2)")).toBe(-3);
  });

  test("division by zero is a formula error", () => {
    expect(() => run("1/0")).toThrow(FormulaError);
    expect(() => run("1/0")).toThrow("#DIV/0!");
  });
});

describe("cell references", () => {
  test("refs read through the getter (case-insensitive)", () => {
    expect(run("A1+B2", { A1: 10, B2: 5 })).toBe(15);
    expect(run("a1*2", { A1: 21 })).toBe(42);
  });

  test("refsOf lists direct dependencies", () => {
    expect(refsOf(parseFormula("A1+B2*A1"))).toEqual(["A1", "B2"]);
  });

  test("refsOf expands ranges", () => {
    expect(refsOf(parseFormula("SUM(A1:A3)"))).toEqual(["A1", "A2", "A3"]);
    expect(refsOf(parseFormula("SUM(A1:B2)"))).toEqual([
      "A1",
      "B1",
      "A2",
      "B2",
    ]);
  });
});

describe("functions", () => {
  const env = { A1: 1, A2: 2, A3: 3, B1: 10 };

  test("SUM over a range and scalars", () => {
    expect(run("SUM(A1:A3)", env)).toBe(6);
    expect(run("SUM(A1:A3, B1, 4)", env)).toBe(20);
  });

  test("AVG, MIN, MAX, COUNT", () => {
    expect(run("AVG(A1:A3)", env)).toBe(2);
    expect(run("MIN(A1:A3)", env)).toBe(1);
    expect(run("MAX(A1:A3, B1)", env)).toBe(10);
    expect(run("COUNT(A1:A3)", env)).toBe(3);
  });

  test("function names are case-insensitive", () => {
    expect(run("sum(A1:A3)", env)).toBe(6);
  });

  test("unknown function is a #NAME? error", () => {
    expect(() => run("NOPE(1)")).toThrow("#NAME?");
  });
});

describe("parse errors", () => {
  test("garbage throws", () => {
    expect(() => parseFormula("1+")).toThrow();
    expect(() => parseFormula("(1")).toThrow();
    expect(() => parseFormula("1 2")).toThrow();
    expect(() => parseFormula("")).toThrow();
  });

  test("a bare range outside a function argument is rejected", () => {
    expect(() => parseFormula("A1:A3+1")).toThrow();
  });
});

describe("SUMPRODUCT", () => {
  const env = { A1: 2, A2: 1, B1: 3000, B2: 1000 };

  test("pairs ranges element-wise: qty × price", () => {
    expect(run("SUMPRODUCT(A1:A2, B1:B2)", env)).toBe(7000);
  });

  test("three ranges multiply through", () => {
    expect(run("SUMPRODUCT(A1:A2, A1:A2, B1:B2)", env)).toBe(13000);
  });

  test("mismatched range lengths are a #ERR!", () => {
    expect(() => run("SUMPRODUCT(A1:A2, B1:B3)", env)).toThrow("#ERR!");
  });
});
