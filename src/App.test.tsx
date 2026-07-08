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

describe("column/row selection and formatting", () => {
  test("clicking the column letter selects the whole column", () => {
    const s = setup();
    const headC = [...s.container.querySelectorAll(".cell.head")].find(
      (h) => h.textContent === "C",
    )!;
    headC.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(s.cell("C1").className).toContain("active");
    expect(s.cell("C50").className).toContain("in-range");
    expect(s.cell("C99").className).toContain("in-range");
    expect(s.cell("B5").className).not.toContain("in-range");
    s.dispose();
  });

  test("Ctrl+B applies bold to every cell of the selection and undoes as one step", () => {
    const s = setup();
    key(s.grid, "5");
    s.typeInto("5"); // A1
    const headA = [...s.container.querySelectorAll(".cell.head")].find(
      (h) => h.textContent === "A",
    )!;
    headA.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(s.grid, "b", { ctrlKey: true });

    expect(s.cell("A1").getAttribute("style")).toContain("font-weight:700");
    expect(s.cell("A42").getAttribute("style")).toContain("font-weight:700");

    key(s.grid, "z", { ctrlKey: true }); // one undo removes the whole format
    expect(s.cell("A1").getAttribute("style")).not.toContain("font-weight");
    expect(s.cell("A1").textContent).toBe("5"); // the value survived
    s.dispose();
  });

  test("committing a value over a multi-selection fills the whole range", () => {
    const s = setup();
    s.cell("A1").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(s.grid, "ArrowDown", { shiftKey: true });
    key(s.grid, "ArrowDown", { shiftKey: true });
    key(s.grid, "0"); // starts the editor over A1:A3
    s.typeInto("0");
    expect(s.cell("A1").textContent).toBe("0");
    expect(s.cell("A2").textContent).toBe("0");
    expect(s.cell("A3").textContent).toBe("0");
    s.dispose();
  });

  test("row resize handles exist on row headers", () => {
    const s = setup();
    expect(s.container.querySelectorAll(".row-resizer").length).toBe(99);
    s.dispose();
  });
});

describe("structured tables", () => {
  const openPanel = (s: ReturnType<typeof setup>) => {
    const insertMenu = [...s.container.querySelectorAll(".menu-item")].find(
      (m) => m.textContent === "Вставка",
    )!;
    insertMenu.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const item = [...s.container.querySelectorAll(".dd-item")].find(
      (b) => b.textContent === "Таблицы",
    ) as HTMLButtonElement;
    item.click();
  };

  test("inserting «Пользователи» renders the header band at the cursor", () => {
    const s = setup();
    openPanel(s);
    const tpl = [...s.container.querySelectorAll(".tp-item")].find((b) =>
      b.textContent!.includes("Пользователи"),
    ) as HTMLButtonElement;
    tpl.click();

    expect(s.cell("A1").textContent).toBe("Имя");
    expect(s.cell("A1").className).toContain("t-header");
    expect(s.cell("C1").textContent).toBe("Статус");
    expect(s.cell("C2").className).toContain("t-select");
    s.dispose();
  });

  test("a select cell opens the chip dropdown and writes the choice", () => {
    const s = setup();
    openPanel(s);
    (
      [...s.container.querySelectorAll(".tp-item")].find((b) =>
        b.textContent!.includes("Пользователи"),
      ) as HTMLButtonElement
    ).click();

    s.cell("C2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const dd = s.container.querySelector(".select-dd")!;
    const opt = [...dd.querySelectorAll(".select-opt")].find((b) =>
      b.textContent!.includes("В отпуске"),
    ) as HTMLButtonElement;
    opt.click();

    expect(s.cell("C2").textContent).toContain("В отпуске");
    expect(s.cell("C2").getAttribute("style")).toContain("#bfe1f6");
    s.dispose();
  });

  test("«добавить строки» grows the table; undo removes the whole insert", () => {
    const s = setup();
    openPanel(s);
    (
      [...s.container.querySelectorAll(".tp-item")].find((b) =>
        b.textContent!.includes("Задачи"),
      ) as HTMLButtonElement
    ).click();

    const before = s.container.querySelectorAll(".t-select").length;
    (s.container.querySelector(".add-rows-btn") as HTMLButtonElement).click();
    expect(s.container.querySelectorAll(".t-select").length).toBeGreaterThan(
      before,
    );

    key(s.grid, "z", { ctrlKey: true }); // undo add-rows
    key(s.grid, "z", { ctrlKey: true }); // undo the table itself
    expect(s.container.querySelectorAll(".t-header").length).toBe(0);
    s.dispose();
  });
});

describe("sheets toolbar", () => {
  test("borders dropdown applies outer borders to the selection", () => {
    const s = setup();
    s.cell("B2").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    key(s.grid, "ArrowDown", { shiftKey: true });
    key(s.grid, "ArrowRight", { shiftKey: true }); // B2:C3

    (
      s.container.querySelector('[title="Границы"]') as HTMLButtonElement
    ).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    (
      s.container.querySelector(
        '[title="Внешние границы"]',
      ) as HTMLButtonElement
    ).click();

    expect(s.cell("B2").getAttribute("style")).toContain("border-top");
    expect(s.cell("B2").getAttribute("style")).toContain("border-left");
    expect(s.cell("B2").getAttribute("style")).not.toContain("border-right");
    expect(s.cell("C3").getAttribute("style")).toContain("border-bottom");
    key(s.grid, "z", { ctrlKey: true }); // one undo clears the whole frame
    expect(s.cell("B2").getAttribute("style")).not.toContain("border-top");
    s.dispose();
  });

  test("percent format renders the value ×100 with a sign", () => {
    const s = setup();
    key(s.grid, "0");
    s.typeInto("0.25");
    key(s.grid, "ArrowUp");
    (
      s.container.querySelector(
        '[title="Процентный формат"]',
      ) as HTMLButtonElement
    ).click();
    expect(s.cell("A1").textContent).toBe("25%");
    s.dispose();
  });

  test("decimal buttons shift precision", () => {
    const s = setup();
    key(s.grid, "3");
    s.typeInto("3.14159");
    key(s.grid, "ArrowUp");
    const inc = s.container.querySelector(
      '[title="Увеличить число знаков после запятой"]',
    ) as HTMLButtonElement;
    inc.click();
    inc.click();
    expect(s.cell("A1").textContent).toBe("3.14");
    s.dispose();
  });

  test("Σ inserts a function draft into the editor", () => {
    const s = setup();
    (
      s.container.querySelector('[title="Ещё"]') as HTMLButtonElement
    ).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    const sum = [...s.container.querySelectorAll(".more-fns .dd-item")].find(
      (b) => b.textContent === "SUM",
    ) as HTMLButtonElement;
    sum.click();
    expect(s.editor()).not.toBeNull();
    expect(s.editor()!.value).toBe("=SUM(");
    s.dispose();
  });
});
