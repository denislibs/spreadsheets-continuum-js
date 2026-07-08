// Structured tables composable: the presentation map derived from the sheet's
// tables, the insert-template flow, the "which table is the cursor in" view,
// and the state of the one global select-dropdown overlay.

import { newBehavior, Behavior } from "@continuum-js/frp";
import { onCleanup, onMount } from "@continuum-js/dom";
import { cellId, CLEAR_FORMAT, type Pos } from "../model/sheet.js";
import {
  TEMPLATES,
  instantiate,
  presentationOf,
  tableAt,
  type Template,
  type Table,
  type TableFmt,
  type CellPresentation,
  type SelectOption,
  type ColumnKind,
} from "../model/tables.js";
import type { Sheet } from "./createSheet.js";
import type { Selection } from "./createSelection.js";
import type { Layout } from "./createLayout.js";

/** Sheets look: table header rows are taller — the name tab sits in the
 * top part, the column names at the bottom. */
export const HEADER_ROW_H = 46;

export interface OpenSelect {
  pos: Pos;
  options: SelectOption[];
}

export interface Tables {
  templates: Template[];
  /** all tables (for pinned header bands) */
  list: Behavior<Table[]>;
  /** cellId → what the table system wants this cell to look like */
  presentation: Behavior<Map<string, CellPresentation>>;
  /** the table containing the selection anchor, if any */
  active: Behavior<Table | undefined>;
  panelOpen: Behavior<boolean>;
  openPanel: () => void;
  closePanel: () => void;
  insert: (tpl: Template) => void;
  addRows: (id: string, count: number) => void;
  /** the one global dropdown overlay for select-kind cells */
  openSelect: Behavior<OpenSelect | null>;
  showSelect: (pos: Pos, options: SelectOption[]) => void;
  choose: (pos: Pos, label: string) => void;
  closeSelect: () => void;
  /** the calendar overlay for date-kind cells */
  openDate: Behavior<Pos | null>;
  showDate: (pos: Pos) => void;
  pickDate: (pos: Pos, label: string) => void;
  closeDate: () => void;
  /** the table-name chip menu and the per-column header menus */
  tableMenuOpen: Behavior<boolean>;
  toggleTableMenu: () => void;
  renaming: Behavior<boolean>;
  startRename: () => void;
  commitRename: (id: string, name: string) => void;
  colMenu: Behavior<number | null>;
  toggleColMenu: (col: number) => void;
  /** the select-options editor panel («Правила проверки данных») */
  optionsEditor: Behavior<number | null>;
  openOptionsEditor: (col: number) => void;
  closeOptionsEditor: () => void;
  setOptions: (id: string, at: number, options: SelectOption[]) => void;
  closeMenus: () => void;
  rename: (id: string, name: string) => void;
  setColor: (id: string, color: string) => void;
  /** «Форматирование таблицы» toggles */
  setFormat: (id: string, patch: Partial<TableFmt>) => void;
  /** «Отменить форматирование данных» — clear every cell format in the region */
  clearDataFormats: (t: Table) => void;
  remove: (id: string) => void;
  setKind: (id: string, at: number, kind: ColumnKind) => void;
  insertColumn: (id: string, at: number) => void;
  removeColumn: (id: string, at: number) => void;
  sort: (id: string, at: number, dir: "asc" | "desc") => void;
}

export function createTables(
  sheet: Sheet,
  selection: Selection,
  layout: Layout,
): Tables {
  const [panelOpen, setPanelOpen] = newBehavior(false);
  const [openSelect, setOpenSelect] = newBehavior<OpenSelect | null>(null);
  const [openDate, setOpenDate] = newBehavior<Pos | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = newBehavior(false);
  const [renaming, setRenaming] = newBehavior(false);
  const [colMenu, setColMenu] = newBehavior<number | null>(null);
  const [optionsEditor, setOptionsEditor] = newBehavior<number | null>(null);

  // any mousedown that no popover swallowed (cells, toolbar, blank space)
  // dismisses the header menus — the menus and their ▾ toggles stop
  // propagation. Renaming is left alone: its commit rides the input's blur.
  onMount(() => {
    const close = () => {
      setTableMenuOpen(false);
      setColMenu(null);
    };
    window.addEventListener("mousedown", close);
    onCleanup(() => window.removeEventListener("mousedown", close));
  });

  const insert = (tpl: Template) => {
    const anchor = selection.anchor.sample();
    sheet.dispatch({
      type: "addTable",
      table: instantiate(tpl, anchor, crypto.randomUUID()),
    });
    if (layout.heights.sample()[anchor.r] < HEADER_ROW_H)
      layout.setRowHeight(anchor.r, HEADER_ROW_H);
    setPanelOpen(false);
  };

  return {
    templates: TEMPLATES,
    list: sheet.tables,
    presentation: sheet.tables.map(presentationOf),
    active: Behavior.lift2(
      (ts, a) => tableAt(ts, a),
      sheet.tables,
      selection.anchor,
    ),
    panelOpen,
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
    insert,
    addRows: (id, count) => sheet.dispatch({ type: "addTableRows", id, count }),
    openSelect,
    showSelect: (pos, options) => setOpenSelect({ pos, options }),
    choose: (pos, label) => {
      sheet.dispatch({ type: "edit", id: cellId(pos.c, pos.r), raw: label });
      setOpenSelect(null);
    },
    closeSelect: () => setOpenSelect(null),
    openDate,
    showDate: (pos) => setOpenDate(pos),
    pickDate: (pos, label) => {
      sheet.dispatch({ type: "edit", id: cellId(pos.c, pos.r), raw: label });
      setOpenDate(null);
    },
    closeDate: () => setOpenDate(null),
    tableMenuOpen,
    toggleTableMenu: () => {
      setColMenu(null);
      setOpenSelect(null); // one popover at a time
      setOpenDate(null);
      setTableMenuOpen(!tableMenuOpen.sample());
    },
    renaming,
    startRename: () => {
      setTableMenuOpen(false);
      setRenaming(true);
    },
    commitRename: (id, name) => {
      if (name.trim())
        sheet.dispatch({ type: "renameTable", id, name: name.trim() });
      setRenaming(false);
    },
    colMenu,
    toggleColMenu: (col) => {
      setTableMenuOpen(false);
      setOpenSelect(null); // one popover at a time
      setOpenDate(null);
      setColMenu(colMenu.sample() === col ? null : col);
    },
    optionsEditor,
    openOptionsEditor: (col) => {
      setColMenu(null);
      setOptionsEditor(col);
    },
    closeOptionsEditor: () => setOptionsEditor(null),
    setOptions: (id, at, options) => {
      sheet.dispatch({ type: "setColumnOptions", id, at, options });
      setOptionsEditor(null);
    },
    closeMenus: () => {
      setTableMenuOpen(false);
      setColMenu(null);
      setRenaming(false);
    },
    rename: (id, name) => sheet.dispatch({ type: "renameTable", id, name }),
    setColor: (id, color) => {
      sheet.dispatch({ type: "setTableColor", id, color });
      setTableMenuOpen(false);
    },
    setFormat: (id, patch) => {
      sheet.dispatch({ type: "setTableFormat", id, patch });
      setTableMenuOpen(false);
    },
    clearDataFormats: (t) => {
      const ids: string[] = [];
      for (let i = 0; i < t.columns.length; i++)
        for (let dr = 1; dr <= t.rows; dr++)
          ids.push(cellId(t.anchor.c + i, t.anchor.r + dr));
      sheet.dispatch({ type: "format", ids, patch: CLEAR_FORMAT });
      setTableMenuOpen(false);
    },
    remove: (id) => {
      sheet.dispatch({ type: "removeTable", id });
      setTableMenuOpen(false);
    },
    setKind: (id, at, kind) => {
      sheet.dispatch({ type: "setColumnKind", id, at, kind });
      setColMenu(null);
    },
    insertColumn: (id, at) => {
      sheet.dispatch({ type: "insertTableColumn", id, at });
      setColMenu(null);
    },
    removeColumn: (id, at) => {
      sheet.dispatch({ type: "removeTableColumn", id, at });
      setColMenu(null);
    },
    sort: (id, at, dir) => {
      sheet.dispatch({ type: "sortTable", id, at, dir });
      setColMenu(null);
    },
  };
}
