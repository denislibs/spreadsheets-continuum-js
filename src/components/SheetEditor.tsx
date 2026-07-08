// Continuum Tables — a Google-Sheets-style app as a stream-first showcase.
//
// The whole architecture is ONE stream of actions folded three ways:
//   actions ──accum──▶ sheet state (cells + formats + undo history)
//              └──────▶ persistence (mirror of the folded value)
//              └──────▶ cross-tab sync (the `storage` event is one more
//                       dispatcher into the same reducer)
//
// This file only composes: state lives in composables (createSheet,
// createSelection, createEditor, createLayout), behavior wiring in pure
// factories (makeFormatting, makeKeyHandlers), rendering in components.

import { onCleanup } from "@continuum-js/dom";
import { idsInRect, toCsv } from "../model/sheet.js";
import { docKey, touchDoc, renameDoc } from "../model/docs.js";
import { createSheet } from "../composables/createSheet.js";
import { createSelection } from "../composables/createSelection.js";
import { createEditor } from "../composables/createEditor.js";
import { createLayout } from "../composables/createLayout.js";
import { createTables } from "../composables/createTables.js";
import { makeFormatting } from "../lib/formatting.js";
import { makeKeyHandlers } from "../lib/keys.js";
import { Chrome, createDocTitle, type Menu } from "./Chrome.js";
import { Toolbar } from "./Toolbar.js";
import { FormulaBar } from "./FormulaBar.js";
import { Grid } from "./Grid.js";
import { StatusBar } from "./StatusBar.js";
import { TablesPanel } from "./TablesPanel.js";

export function SheetEditor(props: { docId: string }) {
  const base = docKey(props.docId);
  const sheet = createSheet(base);
  const selection = createSelection();
  const editor = createEditor(sheet, selection);
  const layout = createLayout(base);
  const { title, setTitle } = createDocTitle(base);
  const tables = createTables(sheet, selection, layout);

  // keep the home-page registry in sync: activity bumps updatedAt, the
  // document title mirrors into the doc list
  onCleanup(sheet.actions.listen(() => touchDoc(props.docId)));
  onCleanup(title.listen((t) => renameDoc(props.docId, t)));

  const fmt = makeFormatting(sheet, selection);

  let gridEl!: HTMLDivElement;
  const focusGrid = () => gridEl.focus();
  const keys = makeKeyHandlers(sheet, selection, editor, fmt, focusGrid);

  const downloadCsv = () => {
    const blob = new Blob(["﻿" + toCsv(sheet.computed.sample())], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.sample().trim() || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const menus: Menu[] = [
    {
      name: "Файл",
      items: [
        {
          label: "Создать",
          action: () =>
            sheet.dispatch({
              type: "replace",
              cells: new Map(),
              formats: new Map(),
            }),
        },
        { label: "Открыть", disabled: true },
        { label: "Создать копию", disabled: true },
        { sep: true },
        { label: "Скачать (.csv)", action: downloadCsv },
        { sep: true },
        { label: "Печать", action: () => window.print() },
      ],
    },
    {
      name: "Правка",
      items: [
        {
          label: "Отменить",
          action: () => sheet.dispatch({ type: "undo" }),
          disabled: sheet.canUndo.map((v) => !v),
        },
        {
          label: "Повторить",
          action: () => sheet.dispatch({ type: "redo" }),
          disabled: sheet.canRedo.map((v) => !v),
        },
        { sep: true },
        {
          label: "Удалить значения",
          action: () =>
            sheet.dispatch({
              type: "clearRange",
              ids: idsInRect(selection.rect.sample()),
            }),
        },
      ],
    },
    { name: "Вид", items: [] },
    {
      name: "Вставка",
      items: [{ label: "Таблицы", action: tables.openPanel }],
    },
    {
      name: "Формат",
      items: [
        {
          label: "Числа",
          sub: [
            {
              label: "Автоматический формат",
              action: () => fmt.apply({ nf: undefined, dec: undefined }),
            },
            {
              label: "Обычный текст",
              action: () => fmt.apply({ nf: "plain" }),
            },
            { sep: true },
            {
              label: "Число",
              hint: "1 000,12",
              action: () => fmt.apply({ nf: "number" }),
            },
            {
              label: "Процент",
              hint: "10,12%",
              action: () => fmt.apply({ nf: "percent" }),
            },
            {
              label: "Экспоненциальный",
              hint: "1,01E+03",
              action: () => fmt.apply({ nf: "scientific" }),
            },
            { sep: true },
            {
              label: "Финансы",
              hint: "(1 000,12)",
              action: () => fmt.apply({ nf: "financial" }),
            },
            {
              label: "Валюта",
              hint: "₽1 000,12",
              action: () => fmt.apply({ nf: "currency" }),
            },
            {
              label: "Валюта (с округлением)",
              hint: "₽1 000",
              action: () => fmt.apply({ nf: "currency0" }),
            },
            { sep: true },
            {
              label: "Дата",
              hint: "26.09.2008",
              action: () => fmt.apply({ nf: "date" }),
            },
            {
              label: "Время",
              hint: "15:59:00",
              action: () => fmt.apply({ nf: "time" }),
            },
          ],
        },
        {
          label: "Текст",
          sub: [
            {
              label: "Полужирный",
              hint: "Ctrl+B",
              action: () => fmt.toggle("b"),
            },
            { label: "Курсив", hint: "Ctrl+I", action: () => fmt.toggle("i") },
            {
              label: "Подчёркнутый",
              hint: "Ctrl+U",
              action: () => fmt.toggle("u"),
            },
            { label: "Зачёркнутый", action: () => fmt.toggle("s") },
          ],
        },
        {
          label: "Выравнивание",
          sub: [
            { label: "Слева", action: () => fmt.apply({ al: "left" }) },
            { label: "По центру", action: () => fmt.apply({ al: "center" }) },
            { label: "Справа", action: () => fmt.apply({ al: "right" }) },
          ],
        },
        {
          label: "Перенос",
          sub: [
            { label: "Переносить", action: () => fmt.apply({ wr: true }) },
            { label: "Обрезать", action: () => fmt.apply({ wr: undefined }) },
          ],
        },
        { sep: true },
        { label: "Условное форматирование", disabled: true },
        { sep: true },
        {
          label: "Очистить форматирование",
          hint: "Ctrl+\\",
          action: fmt.clear,
        },
      ],
    },
    { name: "Данные", items: [] },
    { name: "Инструменты", items: [] },
    { name: "Расширения", items: [] },
    { name: "Справка", items: [] },
  ];

  return (
    <div class="app">
      <Chrome
        title={title}
        setTitle={setTitle}
        menus={menus}
        onMenuAction={focusGrid}
      />
      <Toolbar
        sheet={sheet}
        editor={editor}
        fmt={fmt}
        setZoom={layout.setZoom}
        focusGrid={focusGrid}
      />
      <FormulaBar
        selection={selection}
        editor={editor}
        onKeydown={keys.onEditorKeyDown}
      />
      <Grid
        sheet={sheet}
        selection={selection}
        editor={editor}
        layout={layout}
        tables={tables}
        onKeydown={keys.onGridKeyDown}
        onEditorKeydown={keys.onEditorKeyDown}
        gridRef={(el) => (gridEl = el)}
      />
      <StatusBar sheet={sheet} selection={selection} />
      <TablesPanel tables={tables} />
    </div>
  );
}
