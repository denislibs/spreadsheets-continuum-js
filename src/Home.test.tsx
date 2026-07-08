import { describe, test, expect, beforeEach } from "vitest";
import { mount } from "@continuum-js/dom";
import { navigate } from "@continuum-js/router";
import { App } from "./App.js";
import { loadDocs, createDoc } from "./model/docs.js";

function setup() {
  localStorage.clear();
  navigate("/");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = mount(container, () => <App />);
  return { container, dispose };
}

describe("home page and routing", () => {
  beforeEach(() => localStorage.clear());

  test("shows the create strip and an empty recent list", () => {
    const s = setup();
    expect(s.container.textContent).toContain("Создать таблицу");
    expect(s.container.textContent).toContain("Пустая таблица");
    expect(s.container.textContent).toContain("Пока пусто");
    s.dispose();
  });

  test("creating a blank sheet navigates into the editor and registers it", () => {
    const s = setup();
    (
      [...s.container.querySelectorAll(".tpl-card")].find((c) =>
        c.textContent!.includes("Пустая таблица"),
      ) as HTMLButtonElement
    ).click();

    expect(location.pathname).toMatch(/^\/d\//);
    expect(s.container.querySelector(".grid")).not.toBeNull();
    expect(loadDocs()).toHaveLength(1);
    s.dispose();
  });

  test("a template card pre-seeds the new document with its table", () => {
    const s = setup();
    (
      [...s.container.querySelectorAll(".tpl-card")].find((c) =>
        c.textContent!.includes("Кандидаты"),
      ) as HTMLButtonElement
    ).click();

    expect(s.container.querySelector(".cell.t-header")!.textContent).toBe(
      "Кандидат",
    );
    s.dispose();
  });

  test("the list opens an existing document; delete removes it", () => {
    localStorage.clear();
    const doc = createDoc("Бюджет");
    const s = { ...setupAt("/") };
    expect(s.container.textContent).toContain("Бюджет");

    (s.container.querySelector(".doc-row") as HTMLElement).click();
    expect(location.pathname).toBe(`/d/${doc.id}`);
    expect(s.container.querySelector(".grid")).not.toBeNull();
    s.dispose();

    const s2 = setupAt("/");
    (s2.container.querySelector(".doc-menu .tool") as HTMLElement).click();
    (
      [...s2.container.querySelectorAll(".doc-dd .dd-item")].find(
        (b) => b.textContent === "Удалить",
      ) as HTMLButtonElement
    ).click();
    expect(loadDocs()).toHaveLength(0);
    s2.dispose();
  });
});

function setupAt(path: string) {
  navigate(path);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = mount(container, () => <App />);
  return { container, dispose };
}
