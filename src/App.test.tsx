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
    expect(container.textContent).toContain("Заполнено ячеек: 0");
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

describe("range selection", () => {
  test("Shift+Arrow grows the rectangle and the status bar aggregates it", () => {
    const s = setup();
    key(s.grid, "1");
    s.typeInto("1"); // A1, selection moves to A2
    key(s.grid, "3");
    s.typeInto("3"); // A2, selection moves to A3

    // back to A1, then extend the selection down over both cells
    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowDown", { shiftKey: true });

    expect(s.cell("A1").className).toContain("active");
    expect(s.cell("A2").className).toContain("in-range");
    expect(s.container.textContent).toContain("Сумма: 4");
    expect(s.container.textContent).toContain("Среднее: 2");
    s.dispose();
  });

  test("Delete clears the whole range as ONE undo step", () => {
    const s = setup();
    key(s.grid, "1");
    s.typeInto("1");
    key(s.grid, "2");
    s.typeInto("2");

    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowDown", { shiftKey: true });
    key(s.grid, "Delete");
    expect(s.cell("A1").textContent).toBe("");
    expect(s.cell("A2").textContent).toBe("");

    key(s.grid, "z", { ctrlKey: true }); // one Ctrl+Z brings both back
    expect(s.cell("A1").textContent).toBe("1");
    expect(s.cell("A2").textContent).toBe("2");
    s.dispose();
  });

  test("mouse drag selects a range", () => {
    const s = setup();
    s.cell("B2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    s.cell("C3").dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(s.cell("C3").className).toContain("in-range");
    expect(s.cell("B3").className).toContain("in-range");
    window.dispatchEvent(new MouseEvent("mouseup"));
    s.dispose();
  });
});

describe("chrome", () => {
  test("renders the Sheets-style header and an editable title", () => {
    const s = setup();
    expect(s.container.textContent).toContain("Файл");
    expect(s.container.textContent).toContain("Настройки Доступа");
    const t = s.container.querySelector<HTMLInputElement>(".doc-title")!;
    expect(t.value).toBe("Новая таблица");
    s.dispose();
  });

  test("column resize handles exist on header cells", () => {
    const s = setup();
    expect(s.container.querySelectorAll(".col-resizer").length).toBe(26);
    s.dispose();
  });
});

describe("column formulas in the UI", () => {
  test("=A#*B# computes new rows as they appear", () => {
    const s = setup();
    key(s.grid, "2");
    s.typeInto("2"); // A1 = 2, move to A2
    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowRight"); // B1
    key(s.grid, "3");
    s.typeInto("3000"); // B1 = 3000, move to B2
    key(s.grid, "ArrowUp");
    key(s.grid, "ArrowRight"); // C1
    key(s.grid, "=");
    s.typeInto("=A#*B#"); // column formula
    expect(s.cell("C1").textContent).toBe("6000");

    // a brand-new row: fill A2 and B2 — C2 computes itself
    s.cell("A2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(s.grid, "1");
    s.typeInto("1");
    s.cell("B2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(s.grid, "1");
    s.typeInto("1000");
    expect(s.cell("C2").textContent).toBe("1000");
    s.dispose();
  });
});

describe("menus", () => {
  test("Файл opens a dropdown with working items", () => {
    const s = setup();
    const file = [...s.container.querySelectorAll(".menu-item")].find(
      (m) => m.textContent === "Файл",
    )!;
    file.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const dd = s.container.querySelector(".dropdown")!;
    expect(dd.textContent).toContain("Скачать (.csv)");
    expect(dd.textContent).toContain("Печать");
    s.dispose();
  });
});
