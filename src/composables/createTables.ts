// Structured tables composable: the presentation map derived from the sheet's
// tables, the insert-template flow, the "which table is the cursor in" view,
// and the state of the one global select-dropdown overlay.

import { newBehavior, Behavior } from "@continuum-js/frp";
import { cellId, type Pos } from "../model/sheet.js";
import {
  TEMPLATES,
  instantiate,
  presentationOf,
  tableAt,
  type Template,
  type Table,
  type CellPresentation,
  type SelectOption,
} from "../model/tables.js";
import type { Sheet } from "./createSheet.js";
import type { Selection } from "./createSelection.js";

export interface OpenSelect {
  pos: Pos;
  options: SelectOption[];
}

export interface Tables {
  templates: Template[];
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
}

export function createTables(sheet: Sheet, selection: Selection): Tables {
  const [panelOpen, setPanelOpen] = newBehavior(false);
  const [openSelect, setOpenSelect] = newBehavior<OpenSelect | null>(null);

  const insert = (tpl: Template) => {
    const anchor = selection.anchor.sample();
    sheet.dispatch({
      type: "addTable",
      table: instantiate(tpl, anchor, crypto.randomUUID()),
    });
    setPanelOpen(false);
  };

  return {
    templates: TEMPLATES,
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
  };
}
