// Keyboard wiring — a pure factory over the composables (no lifecycle).

import type { Events } from "@continuum-js/dom";
import { idsInRect, type Pos } from "../model/sheet.js";
import type { Sheet } from "../composables/createSheet.js";
import type { Selection } from "../composables/createSelection.js";
import type { Editor } from "../composables/createEditor.js";
import type { Formatting, ToggleKey } from "./formatting.js";

const NAV: Record<string, Pos> = {
  ArrowUp: { c: 0, r: -1 },
  ArrowDown: { c: 0, r: 1 },
  ArrowLeft: { c: -1, r: 0 },
  ArrowRight: { c: 1, r: 0 },
};

const FORMAT_KEYS: Record<string, ToggleKey> = { b: "b", i: "i", u: "u" };

export function makeKeyHandlers(
  sheet: Sheet,
  selection: Selection,
  editor: Editor,
  fmt: Formatting,
  focusGrid: () => void,
) {
  const onGridKeyDown = (e: Events.KeyboardEvent<HTMLDivElement>) => {
    if (editor.editing.sample()) return; // the editor handles its own keys
    const k = e.key.toLowerCase();
    if (NAV[e.key]) {
      e.preventDefault();
      const d = NAV[e.key];
      if (e.shiftKey) {
        const f = selection.focus.sample();
        selection.extendTo({ c: f.c + d.c, r: f.r + d.r }); // grow the rect
      } else {
        const a = selection.anchor.sample();
        selection.selectOne({ c: a.c + d.c, r: a.r + d.r });
      }
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      editor.start();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      sheet.dispatch({
        type: "clearRange",
        ids: idsInRect(selection.rect.sample()),
      });
    } else if ((e.metaKey || e.ctrlKey) && FORMAT_KEYS[k]) {
      e.preventDefault();
      fmt.toggle(FORMAT_KEYS[k]);
    } else if ((e.metaKey || e.ctrlKey) && k === "z") {
      e.preventDefault();
      sheet.dispatch({ type: e.shiftKey ? "redo" : "undo" });
    } else if ((e.metaKey || e.ctrlKey) && k === "y") {
      e.preventDefault();
      sheet.dispatch({ type: "redo" });
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      editor.start(e.key); // typing replaces the cell, like real sheets
    }
  };

  const onEditorKeyDown = (e: Events.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      editor.commit({ c: 0, r: 1 });
      focusGrid();
    } else if (e.key === "Tab") {
      e.preventDefault();
      editor.commit({ c: 1, r: 0 });
      focusGrid();
    } else if (e.key === "Escape") {
      e.preventDefault();
      editor.cancel();
      focusGrid();
    }
  };

  return { onGridKeyDown, onEditorKeyDown };
}
