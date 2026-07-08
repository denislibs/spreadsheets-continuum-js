// The layout composable: column widths, row heights and zoom — persisted
// mirrors, delivered to the ~2 500 static cells through CSS variables (ONE
// live binding on the grid instead of one per cell) — plus the resize drags.

import { newBehavior, Behavior } from "@continuum-js/frp";
import { onCleanup } from "@continuum-js/dom";
import { distinctB } from "@continuum-js/std";
import type { Events } from "@continuum-js/dom";
import { persist, loadPersisted } from "@continuum-js/std";
import { COLS, ROWS } from "../model/sheet.js";

export const DEFAULT_W = 96;
export const DEFAULT_H = 26;
export const HEAD_W = 48;
export const HEAD_H = 26;
const MIN_W = 40;
const MIN_H = 18;

/** Where the resize guide line sits mid-drag, in content coordinates. */
export interface ResizeGuide {
  axis: "col" | "row";
  px: number;
}

export interface Layout {
  widths: Behavior<number[]>;
  heights: Behavior<number[]>;
  setZoom: (z: number) => void;
  /** CSS vars + zoom for the grid container */
  gridStyle: Behavior<string>;
  /** the grid's vertical scroll offset, in CONTENT units (zoom factored out) */
  scrollTop: Behavior<number>;
  setRowHeight: (r: number, h: number) => void;
  /** non-null while a resize drag is live — only the line repaints, the
   * grid itself is untouched until mouseup applies the size ONCE */
  resizeGuide: Behavior<ResizeGuide | null>;
  /** call from the grid's ref: wires the scroll listener into this owner */
  trackScroll: (el: HTMLElement) => void;
  startColResize: (c: number, e: Events.MouseEvent<HTMLDivElement>) => void;
  startRowResize: (r: number, e: Events.MouseEvent<HTMLDivElement>) => void;
}

// window-scoped drag: self-cleaning on mouseup, no owner needed
function drag(
  e: Events.MouseEvent<HTMLDivElement>,
  onMove: (dx: number, dy: number) => void,
  onUp: (dx: number, dy: number) => void,
): void {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  let dx = 0;
  let dy = 0;
  const move = (ev: MouseEvent) => {
    dx = ev.clientX - x0;
    dy = ev.clientY - y0;
    onMove(dx, dy);
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    onUp(dx, dy);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

export function createLayout(storageKey: string): Layout {
  const [widths, setWidths] = newBehavior<number[]>(
    loadPersisted(`${storageKey}:widths`, Array(COLS).fill(DEFAULT_W)),
  );
  onCleanup(persist(`${storageKey}:widths`, widths));

  const [heights, setHeights] = newBehavior<number[]>(
    loadPersisted(`${storageKey}:heights`, Array(ROWS).fill(DEFAULT_H)),
  );
  onCleanup(persist(`${storageKey}:heights`, heights));

  const [zoom, setZoom] = newBehavior(100);
  const [rawScroll, setRawScroll] = newBehavior(0);
  const [resizeGuide, setResizeGuide] = newBehavior<ResizeGuide | null>(null);
  // content units: the grid is CSS-zoomed, scroll offsets are not
  const scrollTop = distinctB(
    Behavior.lift2((s, z) => Math.round(s / (z / 100)), rawScroll, zoom),
  );

  const gridStyle = Behavior.lift3(
    (ws, hs, z) =>
      ws.map((w, i) => `--w${i}:${w}px`).join(";") +
      ";" +
      hs.map((h, i) => `--h${i}:${h}px`).join(";") +
      `;zoom:${z / 100}`,
    widths,
    heights,
    zoom,
  );

  return {
    widths,
    heights,
    setZoom,
    gridStyle,
    scrollTop,
    setRowHeight: (r, h) => {
      const next = [...heights.sample()];
      next[r] = Math.max(MIN_H, h);
      setHeights(next);
    },
    trackScroll: (el) => {
      const onScroll = () => setRawScroll(el.scrollTop);
      el.addEventListener("scroll", onScroll, { passive: true });
      onCleanup(() => el.removeEventListener("scroll", onScroll));
    },
    resizeGuide,
    startColResize: (c, e) => {
      const w0 = widths.sample()[c];
      const edge =
        HEAD_W +
        widths
          .sample()
          .slice(0, c)
          .reduce((a, b) => a + b, 0);
      drag(
        e,
        (dx) =>
          setResizeGuide({ axis: "col", px: edge + Math.max(MIN_W, w0 + dx) }),
        (dx) => {
          setResizeGuide(null);
          const next = [...widths.sample()];
          next[c] = Math.max(MIN_W, w0 + dx);
          setWidths(next);
        },
      );
    },
    startRowResize: (r, e) => {
      const h0 = heights.sample()[r];
      const edge =
        HEAD_H +
        heights
          .sample()
          .slice(0, r)
          .reduce((a, b) => a + b, 0);
      drag(
        e,
        (_dx, dy) =>
          setResizeGuide({ axis: "row", px: edge + Math.max(MIN_H, h0 + dy) }),
        (_dx, dy) => {
          setResizeGuide(null);
          const next = [...heights.sample()];
          next[r] = Math.max(MIN_H, h0 + dy);
          setHeights(next);
        },
      );
    },
  };
}
