// Протягивание за кружок (the fill handle): what lands in the destination
// when the selection is dragged down or right. Pure — the UI dispatches the
// result as ONE editCells action.

import { indexToCol, colToIndex } from "./formula.js";
import { cellId, type Raw, type Rect, type CellId } from "./sheet.js";

// =A1*10 filled one row down → =A2*10 (column formulas like =A#*B# have no
// digits after the letters, so the shift leaves them alone)
const shiftRefs = (raw: string, dc: number, dr: number): string =>
  raw.replace(
    /([A-Z]+)(\d+)/g,
    (_, col: string, row: string) =>
      `${indexToCol(colToIndex(col) + dc)}${Number(row) + dr}`,
  );

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));

/** ≥2 numbers with a constant step → the step; otherwise null. */
const seriesStep = (vals: string[]): number | null => {
  if (vals.length < 2 || !vals.every(isNum)) return null;
  const nums = vals.map(Number);
  const step = nums[1] - nums[0];
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs(nums[i] - nums[i - 1] - step) > 1e-9) return null;
  }
  return step;
};

/** One lane: series continue, everything else copies cyclically; formulas
 * are shifted by the distance from their source slot to the target. */
const laneValue = (
  vals: string[],
  i: number,
  step: number | null,
  shift: (raw: string, srcIndex: number) => string,
): string => {
  if (step !== null)
    return String(Number(vals[vals.length - 1]) + step * (i + 1));
  const k = i % vals.length;
  const v = vals[k];
  return v.startsWith("=") ? shift(v, k) : v;
};

export function fillEntries(
  cells: Raw,
  src: Rect,
  dest: Rect,
): Array<[CellId, string]> {
  const out: Array<[CellId, string]> = [];
  if (dest.r1 > src.r2) {
    // down: each column is a lane, the pattern repeats row-wise
    for (let c = src.c1; c <= src.c2; c++) {
      const vals: string[] = [];
      for (let r = src.r1; r <= src.r2; r++)
        vals.push(cells.get(cellId(c, r)) ?? "");
      const step = seriesStep(vals);
      for (let r = dest.r1; r <= dest.r2; r++) {
        const v = laneValue(vals, r - dest.r1, step, (raw, k) =>
          shiftRefs(raw, 0, r - (src.r1 + k)),
        );
        out.push([cellId(c, r), v]);
      }
    }
  } else {
    // right: each row is a lane, the pattern repeats column-wise
    for (let r = src.r1; r <= src.r2; r++) {
      const vals: string[] = [];
      for (let c = src.c1; c <= src.c2; c++)
        vals.push(cells.get(cellId(c, r)) ?? "");
      const step = seriesStep(vals);
      for (let c = dest.c1; c <= dest.c2; c++) {
        const v = laneValue(vals, c - dest.c1, step, (raw, k) =>
          shiftRefs(raw, c - (src.c1 + k), 0),
        );
        out.push([cellId(c, r), v]);
      }
    }
  }
  return out;
}
