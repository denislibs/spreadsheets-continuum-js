// Formatting over the selection rectangle. A pure factory (no lifecycle —
// hence no `create` prefix): everything goes through the sheet's action
// stream, so formats undo/persist/sync exactly like values do.

import { Behavior } from "@continuum-js/frp";
import { idsInRect, CLEAR_FORMAT, type CellFormat } from "../model/sheet.js";
import { borderPatches, type BorderKind } from "../model/borders.js";
import type { Sheet } from "../composables/createSheet.js";
import type { Selection } from "../composables/createSelection.js";

export type ToggleKey = "b" | "i" | "u" | "s";

export interface Formatting {
  anchorFormat: Behavior<CellFormat>;
  apply: (patch: Partial<CellFormat>) => void;
  toggle: (key: ToggleKey) => void;
  togglePercent: () => void;
  toggleWrap: () => void;
  /** shift decimal places by ±1 (0…8) */
  shiftDecimals: (delta: 1 | -1) => void;
  applyBorders: (kind: BorderKind) => void;
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
    togglePercent: () =>
      apply({
        nf: anchorFormat.sample().nf === "percent" ? undefined : "percent",
      }),
    toggleWrap: () =>
      apply({ wr: anchorFormat.sample().wr ? undefined : true }),
    shiftDecimals: (delta) => {
      const cur = anchorFormat.sample().dec ?? 0;
      const next = Math.max(0, Math.min(8, cur + delta));
      apply({ dec: next });
    },
    applyBorders: (kind) =>
      sheet.dispatch({
        type: "formatCells",
        entries: borderPatches(selection.rect.sample(), kind),
      }),
    clear: () => apply(CLEAR_FORMAT),
  };
}
