// The fill handle (кружок протягивания): drag the selection's corner dot
// down or right — a dashed preview tracks the pointer, mouseup writes the
// destination as ONE editCells action and grows the selection over it.

import { newBehavior, type Behavior } from "@continuum-js/frp";
import { onCleanup, onMount } from "@continuum-js/dom";
import { fillEntries } from "../model/fill.js";
import type { Pos, Rect } from "../model/sheet.js";
import type { Sheet } from "./createSheet.js";
import type { Selection } from "./createSelection.js";

export interface Fill {
  /** the dashed destination rectangle while the handle is being dragged */
  preview: Behavior<Rect | null>;
  begin: () => void;
  over: (p: Pos) => void;
}

// down or right only, by the dominant direction — like Sheets
const previewOf = (src: Rect, p: Pos): Rect | null => {
  const dRows = p.r - src.r2;
  const dCols = p.c - src.c2;
  if (dRows > 0 && dRows >= dCols) {
    return { c1: src.c1, c2: src.c2, r1: src.r2 + 1, r2: p.r };
  }
  if (dCols > 0) {
    return { r1: src.r1, r2: src.r2, c1: src.c2 + 1, c2: p.c };
  }
  return null;
};

export function createFill(sheet: Sheet, selection: Selection): Fill {
  const [preview, setPreview] = newBehavior<Rect | null>(null);
  let src: Rect | null = null;

  onMount(() => {
    const up = () => {
      const dest = preview.sample();
      if (src && dest) {
        sheet.dispatch({
          type: "editCells",
          entries: fillEntries(sheet.cells.sample(), src, dest),
        });
        // Sheets grows the selection over the filled range
        selection.selectOne({ c: src.c1, r: src.r1 });
        selection.extendTo({
          c: Math.max(src.c2, dest.c2),
          r: Math.max(src.r2, dest.r2),
        });
      }
      src = null;
      setPreview(null);
    };
    window.addEventListener("mouseup", up);
    onCleanup(() => window.removeEventListener("mouseup", up));
  });

  return {
    preview,
    begin: () => {
      src = selection.rect.sample();
    },
    over: (p) => {
      if (src) setPreview(previewOf(src, p));
    },
  };
}
