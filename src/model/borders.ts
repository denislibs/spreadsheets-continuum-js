// Border application over a selection rectangle: each kind maps every cell
// of the rect to its own per-edge patch (hence formatCells, not format).

import { cellId, type CellFormat, type CellId, type Rect } from "./sheet.js";

export type BorderKind =
  | "all"
  | "inner"
  | "horizontal"
  | "vertical"
  | "outer"
  | "left"
  | "top"
  | "right"
  | "bottom"
  | "none";

export function borderPatches(
  rect: Rect,
  kind: BorderKind,
): Array<[CellId, Partial<CellFormat>]> {
  const out: Array<[CellId, Partial<CellFormat>]> = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      const first = { row: r === rect.r1, col: c === rect.c1 };
      const last = { row: r === rect.r2, col: c === rect.c2 };
      let p: Partial<CellFormat> = {};
      switch (kind) {
        case "all":
          p = { bt: true, bb: true, bl: true, br: true };
          break;
        case "outer":
          if (first.row) p.bt = true;
          if (last.row) p.bb = true;
          if (first.col) p.bl = true;
          if (last.col) p.br = true;
          break;
        case "inner":
          if (!first.row) p.bt = true;
          if (!last.row) p.bb = true;
          if (!first.col) p.bl = true;
          if (!last.col) p.br = true;
          break;
        case "horizontal":
          if (!first.row) p.bt = true;
          if (!last.row) p.bb = true;
          break;
        case "vertical":
          if (!first.col) p.bl = true;
          if (!last.col) p.br = true;
          break;
        case "left":
          if (first.col) p.bl = true;
          break;
        case "right":
          if (last.col) p.br = true;
          break;
        case "top":
          if (first.row) p.bt = true;
          break;
        case "bottom":
          if (last.row) p.bb = true;
          break;
        case "none":
          p = { bt: undefined, bb: undefined, bl: undefined, br: undefined };
          break;
      }
      if (Object.keys(p).length > 0) out.push([cellId(c, r), p]);
    }
  }
  return out;
}
