// The editing session: the draft text, whether the editor is open, and the
// commit semantics (a multi-cell selection is FILLED with the committed
// value; =A#*B# templates go to the anchor — # covers the column by itself).

import { newBehavior, Behavior } from "@continuum-js/frp";
import { idsInRect, type Pos } from "../model/sheet.js";
import type { Sheet } from "./createSheet.js";
import type { Selection } from "./createSelection.js";

export interface Editor {
  editing: Behavior<boolean>;
  draft: Behavior<string>;
  setDraft: (v: string) => void;
  /** raw text of the anchor cell (what the formula bar shows when idle) */
  rawOfSelected: Behavior<string>;
  /** the formula bar value: the draft while editing, the raw otherwise */
  barValue: Behavior<string>;
  start: (initial?: string) => void;
  commit: (move: Pos | null) => void;
  cancel: () => void;
}

export function createEditor(sheet: Sheet, selection: Selection): Editor {
  const [editing, setEditing] = newBehavior(false);
  const [draft, setDraft] = newBehavior("");

  const rawOfSelected = Behavior.lift2(
    (id, m) => m.get(id) ?? "",
    selection.selectedId,
    sheet.cells,
  );
  const barValue = Behavior.lift3(
    (e, d, raw) => (e ? d : raw),
    editing,
    draft,
    rawOfSelected,
  );

  const start = (initial?: string) => {
    setDraft(initial ?? rawOfSelected.sample());
    setEditing(true);
  };

  const commit = (move: Pos | null) => {
    if (editing.sample()) {
      const raw = draft.sample().trim();
      if (selection.isMulti() && !raw.includes("#")) {
        dispatchFill(raw);
      } else {
        sheet.dispatch({
          type: "edit",
          id: selection.selectedId.sample(),
          raw,
        });
      }
      setEditing(false);
    }
    if (move) {
      const a = selection.anchor.sample();
      selection.selectOne({ c: a.c + move.c, r: a.r + move.r });
    }
  };

  const dispatchFill = (raw: string) =>
    sheet.dispatch({
      type: "fill",
      ids: idsInRect(selection.rect.sample()),
      raw,
    });

  return {
    editing,
    draft,
    setDraft,
    rawOfSelected,
    barValue,
    start,
    commit,
    cancel: () => setEditing(false),
  };
}
