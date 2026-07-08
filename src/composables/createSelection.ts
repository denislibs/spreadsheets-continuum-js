// The selection composable: an {anchor, focus} rectangle plus the mouse-drag
// state (which lives at the DOM boundary — nothing renders from it).

import { newBehavior, type Behavior } from "@continuum-js/frp";
import { onCleanup, onMount } from "@continuum-js/dom";
import {
  COLS,
  ROWS,
  cellId,
  rectOf,
  type CellId,
  type Pos,
  type Rect,
} from "../model/sheet.js";

export interface Selection {
  anchor: Behavior<Pos>;
  focus: Behavior<Pos>;
  rect: Behavior<Rect>;
  selectedId: Behavior<CellId>;
  selectOne: (p: Pos) => void;
  extendTo: (p: Pos) => void;
  selectColumn: (c: number) => void;
  selectRow: (r: number) => void;
  isMulti: () => boolean;
  /** mousedown on a cell → the rectangle grows while the button is held */
  beginDrag: (p: Pos) => void;
  dragOver: (p: Pos) => void;
}

export function createSelection(): Selection {
  const [sel, setSel] = newBehavior<{ anchor: Pos; focus: Pos }>({
    anchor: { c: 0, r: 0 },
    focus: { c: 0, r: 0 },
  });

  const anchor = sel.map((s) => s.anchor);
  const rect = sel.map((s) => rectOf(s.anchor, s.focus));

  const clamp = (p: Pos): Pos => ({
    c: Math.min(COLS - 1, Math.max(0, p.c)),
    r: Math.min(ROWS - 1, Math.max(0, p.r)),
  });
  const selectOne = (p: Pos) => {
    const q = clamp(p);
    setSel({ anchor: q, focus: q });
  };
  const extendTo = (p: Pos) =>
    setSel({ anchor: sel.sample().anchor, focus: clamp(p) });

  let dragging = false;
  onMount(() => {
    const up = () => (dragging = false);
    window.addEventListener("mouseup", up);
    onCleanup(() => window.removeEventListener("mouseup", up));
  });

  return {
    anchor,
    focus: sel.map((s) => s.focus),
    rect,
    selectedId: anchor.map((p) => cellId(p.c, p.r)),
    selectOne,
    extendTo,
    selectColumn: (c) =>
      setSel({ anchor: { c, r: 0 }, focus: { c, r: ROWS - 1 } }),
    selectRow: (r) =>
      setSel({ anchor: { c: 0, r }, focus: { c: COLS - 1, r } }),
    isMulti: () => {
      const r = rect.sample();
      return r.c1 !== r.c2 || r.r1 !== r.r2;
    },
    beginDrag: (p) => {
      dragging = true;
      selectOne(p);
    },
    dragOver: (p) => {
      if (dragging) extendTo(p);
    },
  };
}
