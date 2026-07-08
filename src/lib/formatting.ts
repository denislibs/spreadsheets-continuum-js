// Formatting over the selection rectangle. A pure factory (no lifecycle —
// hence no `create` prefix): everything goes through the sheet's action
// stream, so formats undo/persist/sync exactly like values do.

import { Behavior } from "@continuum-js/frp";
import { idsInRect, type CellFormat } from "../model/sheet.js";
import type { Sheet } from "../composables/createSheet.js";
import type { Selection } from "../composables/createSelection.js";

export type ToggleKey = "b" | "i" | "u" | "s";

export interface Formatting {
  /** the anchor cell's format — drives the pressed state of toolbar buttons */
  anchorFormat: Behavior<CellFormat>;
  apply: (patch: Partial<CellFormat>) => void;
  toggle: (key: ToggleKey) => void;
  clear: () => void;
}

export function makeFormatting(sheet: Sheet, selection: Selection): Formatting {
  const anchorFormat = Behavior.lift2(
    (id, f) => f.get(id) ?? {},
    selection.selectedId,
    sheet.formats,
  );

  const apply = (patch: Partial<CellFormat>) =>
    sheet.dispatch({
      type: "format",
      ids: idsInRect(selection.rect.sample()),
      patch,
    });

  return {
    anchorFormat,
    apply,
    toggle: (key) =>
      apply({ [key]: anchorFormat.sample()[key] ? undefined : true }),
    clear: () =>
      apply({
        b: undefined,
        i: undefined,
        u: undefined,
        s: undefined,
        al: undefined,
        fg: undefined,
        bg: undefined,
        fs: undefined,
      }),
  };
}
