// Continuum Tables — a Google-Sheets-style app as a stream-first showcase.
//
// The whole architecture is ONE stream of actions folded three ways:
//   actions ──accum──▶ sheet state (cells + undo history)
//              └──────▶ persistence (mirror of the folded value)
//              └──────▶ cross-tab sync (the `storage` event is one more
//                       dispatcher into the same reducer)
// Selection is a rectangle {anchor, focus}; column widths, zoom and the
// document title are plain behaviors (no history worth keeping) with their
// own persistence mirrors. ~2 500 cells × 2 live bindings, no re-renders.

import { newStream, newBehavior, Behavior } from "@continuum-js/frp";
import { Show, onCleanup, onMount } from "@continuum-js/dom";
import type { Events } from "@continuum-js/dom";
import { persist, loadPersisted } from "@continuum-js/std";
import {
  COLS,
  ROWS,
  cellId,
  evalSheet,
  reduce,
  emptySheet,
  toPlain,
  fromPlain,
  format,
  rectOf,
  inRect,
  idsInRect,
  type Action,
} from "./model/sheet.js";
import { indexToCol } from "./model/formula.js";

const LC_KEY = "continuum-tables";
const CELL_H = 26;
const DEFAULT_W = 96;
const MIN_W = 40;
const HEAD_W = 48;

interface Pos {
  c: number;
  r: number;
}

const MENU = [
  "Файл",
  "Правка",
  "Вид",
  "Вставка",
  "Формат",
  "Данные",
  "Инструменты",
  "Расширения",
  "Справка",
];

export function App() {
  // ── the one stream of actions, folded ─────────────────────────────────────
  const [actions, dispatch] = newStream<Action>();
  const state = actions.accum(
    emptySheet(fromPlain(loadPersisted(LC_KEY, {}))),
    reduce,
  );
  const cells = state.map((s) => s.cells);
  const computed = cells.map(evalSheet);
  const canUndo = state.map((s) => s.past.length > 0);
  const canRedo = state.map((s) => s.future.length > 0);

  // persistence: a mirror of the folded value (plain object for JSON)
  onCleanup(persist(LC_KEY, cells.map(toPlain)));

  // cross-tab sync: the other tab's write is just one more dispatcher
  onMount(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LC_KEY && e.newValue) {
        dispatch({ type: "replace", cells: fromPlain(JSON.parse(e.newValue)) });
      }
    };
    window.addEventListener("storage", onStorage);
    onCleanup(() => window.removeEventListener("storage", onStorage));
  });

  // ── document chrome state (no history — plain behaviors + mirrors) ───────
  const [title, setTitle] = newBehavior(
    loadPersisted(`${LC_KEY}:title`, "Новая таблица"),
  );
  onCleanup(persist(`${LC_KEY}:title`, title));

  const [widths, setWidths] = newBehavior<number[]>(
    loadPersisted(`${LC_KEY}:widths`, Array(COLS).fill(DEFAULT_W)),
  );
  onCleanup(persist(`${LC_KEY}:widths`, widths));

  const [zoom, setZoom] = newBehavior(100);

  // column widths reach the 2 500 static cells through CSS variables: ONE
  // live binding on the grid instead of one per cell
  const gridStyle = Behavior.lift2(
    (ws, z) =>
      ws.map((w, i) => `--w${i}:${w}px`).join(";") + `;zoom:${z / 100}`,
    widths,
    zoom,
  );

  // ── selection: a rectangle {anchor, focus} ────────────────────────────────
  const [sel, setSel] = newBehavior<{ anchor: Pos; focus: Pos }>({
    anchor: { c: 0, r: 0 },
    focus: { c: 0, r: 0 },
  });
  const [editing, setEditing] = newBehavior(false);
  const [draft, setDraft] = newBehavior("");

  const anchor = sel.map((s) => s.anchor);
  const selRect = sel.map((s) => rectOf(s.anchor, s.focus));
  const selectedId = anchor.map((p) => cellId(p.c, p.r));
  const rawOfSelected = Behavior.lift2(
    (id, m) => m.get(id) ?? "",
    selectedId,
    cells,
  );
  // the formula bar shows the draft while editing, the raw text otherwise
  const barValue = Behavior.lift3(
    (e, d, raw) => (e ? d : raw),
    editing,
    draft,
    rawOfSelected,
  );

  // live aggregates over the selection, like the real thing's bottom bar
  const aggregates = Behavior.lift2(
    (rect, m) => {
      if (rect.c1 === rect.c2 && rect.r1 === rect.r2) return "";
      const nums = idsInRect(rect)
        .map((id) => m.get(id))
        .filter((v): v is number => typeof v === "number");
      if (nums.length === 0) return "";
      const sum = nums.reduce((a, b) => a + b, 0);
      return `Сумма: ${format(sum)} · Среднее: ${format(sum / nums.length)} · Кол-во: ${nums.length}`;
    },
    selRect,
    computed,
  );
  const filled = cells.map((m) => m.size);

  const clampPos = (p: Pos): Pos => ({
    c: Math.min(COLS - 1, Math.max(0, p.c)),
    r: Math.min(ROWS - 1, Math.max(0, p.r)),
  });
  const selectOne = (p: Pos) => {
    const q = clampPos(p);
    setSel({ anchor: q, focus: q });
  };
  const extendTo = (p: Pos) =>
    setSel({ anchor: sel.sample().anchor, focus: clampPos(p) });

  const startEdit = (initial?: string) => {
    setDraft(initial ?? rawOfSelected.sample());
    setEditing(true);
  };
  const commit = (move: Pos | null) => {
    if (editing.sample()) {
      dispatch({
        type: "edit",
        id: selectedId.sample(),
        raw: draft.sample().trim(),
      });
      setEditing(false);
    }
    if (move) {
      const a = sel.sample().anchor;
      selectOne({ c: a.c + move.c, r: a.r + move.r });
    }
  };
  const cancel = () => setEditing(false);

  // drag state lives at the DOM boundary — nothing renders from it
  let dragging = false;
  onMount(() => {
    const up = () => (dragging = false);
    window.addEventListener("mouseup", up);
    onCleanup(() => window.removeEventListener("mouseup", up));
  });

  // ── column resize: imperative drag at the boundary, one set() per move ───
  const startResize = (col: number, e: Events.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widths.sample()[col];
    const move = (ev: MouseEvent) => {
      const next = [...widths.sample()];
      next[col] = Math.max(MIN_W, startW + (ev.clientX - startX));
      setWidths(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── keyboard: navigation on the grid, commit/cancel in the editor ────────
  const onGridKeyDown = (e: Events.KeyboardEvent<HTMLDivElement>) => {
    if (editing.sample()) return; // the editor input handles its own keys
    const nav: Record<string, Pos> = {
      ArrowUp: { c: 0, r: -1 },
      ArrowDown: { c: 0, r: 1 },
      ArrowLeft: { c: -1, r: 0 },
      ArrowRight: { c: 1, r: 0 },
    };
    if (nav[e.key]) {
      e.preventDefault();
      const d = nav[e.key];
      if (e.shiftKey) {
        const f = sel.sample().focus;
        extendTo({ c: f.c + d.c, r: f.r + d.r }); // grow the rectangle
      } else {
        const a = sel.sample().anchor;
        selectOne({ c: a.c + d.c, r: a.r + d.r });
      }
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "clearRange", ids: idsInRect(selRect.sample()) });
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      dispatch({ type: "redo" });
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      startEdit(e.key); // typing replaces the cell, like real sheets
    }
  };

  const onEditorKeyDown = (e: Events.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit({ c: 0, r: 1 });
      gridEl.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit({ c: 1, r: 0 });
      gridEl.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      gridEl.focus();
    }
  };

  let gridEl!: HTMLDivElement;

  // ── static grid: built once, kept alive by pinpoint bindings ─────────────
  const headerCells = Array.from({ length: COLS }, (_, c) => (
    <div class="cell head" style={`flex-basis:var(--w${c})`}>
      {indexToCol(c + 1)}
      <div class="col-resizer" onMousedown={(e) => startResize(c, e)}></div>
    </div>
  ));

  const rows = Array.from({ length: ROWS }, (_, r) => (
    <div class="row">
      <div class="cell head rowhead">{r + 1}</div>
      {Array.from({ length: COLS }, (_, c) => {
        const id = cellId(c, r);
        const text = computed.map((m) => format(m.get(id)));
        const cls = Behavior.lift2(
          (s, rect) => {
            const active = s.anchor.c === c && s.anchor.r === r;
            const inSel = inRect(rect, c, r);
            return `cell${active ? " active" : inSel ? " in-range" : ""}`;
          },
          sel,
          selRect,
        );
        return (
          <div
            class={cls}
            data-id={id}
            style={`flex-basis:var(--w${c})`}
            onMousedown={(e) => {
              e.preventDefault(); // keep focus on the grid
              commit(null);
              if (e.shiftKey) extendTo({ c, r });
              else {
                dragging = true;
                selectOne({ c, r });
              }
            }}
            onMouseenter={() => {
              if (dragging) extendTo({ c, r });
            }}
            onDblclick={() => startEdit()}
          >
            {text}
          </div>
        );
      })}
    </div>
  ));

  return (
    <div class="app">
      {/* ── row 1: document chrome ─────────────────────────────────────── */}
      <header class="chrome">
        <div class="sheets-logo">▦</div>
        <div class="chrome-main">
          <div class="title-row">
            <input
              class="doc-title"
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <span class="chrome-ico" title="Помеченные">
              ☆
            </span>
            <span class="chrome-ico" title="Перемещено на Диск">
              ☁
            </span>
          </div>
          <nav class="menubar">
            {MENU.map((m) => (
              <span class="menu-item">{m}</span>
            ))}
          </nav>
        </div>
        <div class="chrome-right">
          <span class="chrome-ico" title="История версий">
            ⟲
          </span>
          <span class="chrome-ico" title="Комментарии">
            🗨
          </span>
          <button class="share">🔒 Настройки Доступа</button>
          <div class="avatar" title="Denis">
            D
          </div>
        </div>
      </header>

      {/* ── row 2: toolbar ─────────────────────────────────────────────── */}
      <div class="toolbar">
        <button
          class="tool"
          title="Отменить (Ctrl+Z)"
          disabled={canUndo.map((v) => !v)}
          onClick={() => {
            dispatch({ type: "undo" });
            gridEl.focus();
          }}
        >
          ↩
        </button>
        <button
          class="tool"
          title="Повторить (Ctrl+Shift+Z)"
          disabled={canRedo.map((v) => !v)}
          onClick={() => {
            dispatch({ type: "redo" });
            gridEl.focus();
          }}
        >
          ↪
        </button>
        <button class="tool" title="Печать" onClick={() => window.print()}>
          🖨
        </button>
        <select
          class="zoom"
          title="Масштаб"
          onChange={(e) => setZoom(Number(e.currentTarget.value))}
        >
          <option value="75">75%</option>
          <option value="100" selected>
            100%
          </option>
          <option value="125">125%</option>
          <option value="150">150%</option>
        </select>
        <span class="hint">=A1+B2 · SUM(A1:B9) · AVG · MIN · MAX · COUNT</span>
      </div>

      {/* ── row 3: formula bar ─────────────────────────────────────────── */}
      <div class="formula-bar">
        <span class="cell-name">{selectedId}</span>
        <span class="fx">fx</span>
        <input
          class="formula-input"
          placeholder="Введите значение или =формулу"
          value={barValue}
          onInput={(e) => {
            if (!editing.sample()) setEditing(true);
            setDraft(e.currentTarget.value);
          }}
          onKeydown={onEditorKeyDown}
        />
      </div>

      <div
        class="grid"
        tabindex={0}
        style={gridStyle}
        ref={(el) => (gridEl = el)}
        onKeydown={onGridKeyDown}
      >
        <div class="row">
          <div class="cell head corner"></div>
          {headerCells}
        </div>
        {rows}

        <Show when={editing}>
          {() => (
            <input
              class="editor"
              // Derived INSIDE the region that uses it: the region's scope
              // owns it, so closing the editor disposes it and reopening
              // derives a fresh one. Geometry: widths are dynamic, so the
              // left offset is a prefix sum (+ the sticky header row/col).
              style={Behavior.lift2(
                (p, ws) => {
                  const left =
                    HEAD_W + ws.slice(0, p.c).reduce((a, b) => a + b, 0);
                  return (
                    `left:${left}px;top:${(p.r + 1) * CELL_H}px;` +
                    `width:${ws[p.c]}px;height:${CELL_H}px`
                  );
                },
                anchor,
                widths,
              )}
              value={draft}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeydown={onEditorKeyDown}
              onBlur={() => commit(null)}
              ref={(el) => {
                onMount(() => {
                  el.focus();
                  el.select();
                });
              }}
            />
          )}
        </Show>
      </div>

      <footer class="status">
        <span>Заполнено ячеек: {filled}</span>
        <span class="spacer"></span>
        <span class="agg">{aggregates}</span>
        <span>localStorage · вторая вкладка синхронизируется</span>
      </footer>
    </div>
  );
}
