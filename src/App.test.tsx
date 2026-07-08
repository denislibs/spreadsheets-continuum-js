import { describe, test, expect, beforeEach } from "vitest";
import { mount } from "@continuum-js/dom";
import { App } from "./App.js";

const key = (el: Element, k: string, mods: KeyboardEventInit = {}) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, ...mods }));

function setup() {
  localStorage.clear();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = mount(container, () => <App />);
  const grid = container.querySelector<HTMLDivElement>(".grid")!;
  const cell = (id: string) =>
    container.querySelector<HTMLDivElement>(`[data-id="${id}"]`)!;
  const editor = () => container.querySelector<HTMLInputElement>(".editor");
  const typeInto = (value: string) => {
    const ed = editor()!;
    ed.value = value;
    ed.dispatchEvent(new Event("input", { bubbles: true }));
    key(ed, "Enter");
  };
  return { container, dispose, grid, cell, editor, typeInto };
}

describe("Continuum Tables", () => {
  beforeEach(() => localStorage.clear());

  test("renders headers and an empty grid", () => {
    const { container, dispose } = setup();
    const heads = [...container.querySelectorAll(".cell.head")].map(
      (h) => h.textContent,
    );
    expect(heads).toContain("A");
    expect(heads).toContain("Z");
    expect(heads).toContain("1");
    expect(container.textContent).toContain("cells filled: 0");
    dispose();
  });

  test("typing on a cell opens the editor; Enter commits and moves down", () => {
    const { grid, cell, editor, typeInto, dispose } = setup();

    key(grid, "5"); // typing starts an edit on A1
    expect(editor()).not.toBeNull();
    typeInto("5");

    expect(cell("A1").textContent).toBe("5");
    expect(editor()).toBeNull();
    dispose();
  });

  test("formulas recompute when their inputs change", () => {
    const { grid, cell, typeInto, dispose } = setup();

    key(grid, "2"); // edit A1
    typeInto("2"); // Enter → selection moves to A2
    key(grid, "="); // edit A2
    typeInto("=A1*10");
    expect(cell("A2").textContent).toBe("20");

    // change the input — the dependent cell follows in the same moment
    cell("A1").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(grid, "3");
    typeInto("3");
    expect(cell("A1").textContent).toBe("3");
    expect(cell("A2").textContent).toBe("30");
    dispose();
  });

  test("SUM over a range and error codes render in cells", () => {
    const { grid, cell, typeInto, dispose } = setup();

    key(grid, "1");
    typeInto("1"); // A1
    key(grid, "2");
    typeInto("2"); // A2
    key(grid, "=");
    typeInto("=SUM(A1:A2)"); // A3
    expect(cell("A3").textContent).toBe("3");

    key(grid, "=");
    typeInto("=1/0"); // A4
    expect(cell("A4").textContent).toBe("#DIV/0!");
    dispose();
  });

  test("Ctrl+Z undoes, Ctrl+Shift+Z redoes", () => {
    const { grid, cell, typeInto, dispose } = setup();

    key(grid, "7");
    typeInto("7");
    expect(cell("A1").textContent).toBe("7");

    key(grid, "z", { ctrlKey: true });
    expect(cell("A1").textContent).toBe("");

    key(grid, "z", { ctrlKey: true, shiftKey: true });
    expect(cell("A1").textContent).toBe("7");
    dispose();
  });

  test("the sheet is persisted and picked up by the next mount", () => {
    const first = setup();
    key(first.grid, "9");
    first.typeInto("9");
    first.dispose();

    // a fresh mount reads localStorage — no clearing this time
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = mount(container, () => <App />);
    expect(
      container.querySelector<HTMLDivElement>(`[data-id="A1"]`)!.textContent,
    ).toBe("9");
    dispose();
  });
});
