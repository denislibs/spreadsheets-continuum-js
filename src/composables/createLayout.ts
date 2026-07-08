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

export interface Layout {
  widths: Behavior<number[]>;
  heights: Behavior<number[]>;
  setZoom: (z: number) => void;
  /** CSS vars + zoom for the grid container */
  gridStyle: Behavior<string>;
  /** the grid's vertical scroll offset, in CONTENT units (zoom factored out) */
  scrollTop: Behavior<number>;
  /** call from the grid's ref: wires the scroll listener into this owner */
  trackScroll: (el: HTMLElement) => void;
  startColResize: (c: number, e: Events.MouseEvent<HTMLDivElement>) => void;
  startRowResize: (r: number, e: Events.MouseEvent<HTMLDivElement>) => void;
}

// window-scoped drag: self-cleaning on mouseup, no owner needed
function drag(
  e: Events.MouseEvent<HTMLDivElement>,
  onMove: (dx: number, dy: number) => void,
): void {
  e.preventDefault();
  e.stopPropagation();
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev: MouseEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
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
    trackScroll: (el) => {
      const onScroll = () => setRawScroll(el.scrollTop);
      el.addEventListener("scroll", onScroll, { passive: true });
      onCleanup(() => el.removeEventListener("scroll", onScroll));
    },
    startColResize: (c, e) => {
      const w0 = widths.sample()[c];
      drag(e, (dx) => {
        const next = [...widths.sample()];
        next[c] = Math.max(MIN_W, w0 + dx);
        setWidths(next);
      });
    },
    startRowResize: (r, e) => {
      const h0 = heights.sample()[r];
      drag(e, (_dx, dy) => {
        const next = [...heights.sample()];
        next[r] = Math.max(MIN_H, h0 + dy);
        setHeights(next);
      });
    },
  };
}
