// Continuum Tables — a Google-Sheets-style app as a stream-first showcase.
//
// The whole architecture is ONE stream of actions folded three ways:
//   actions ──accum──▶ sheet state (cells + undo history)
//              └──────▶ persistence (mirror of the folded value)
//              └──────▶ cross-tab sync (the `storage` event is one more
//                       dispatcher into the same reducer)
// The grid is ~2 500 cells, each with two live bindings (text + selection
// class) — and no component ever re-runs.

import { newStream, newBehavior, Behavior } from "@continuum-js/frp";
import { Show, onCleanup, onMount } from "@continuum-js/dom";
import type { Events, Reactive } from "@continuum-js/dom";
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
  type Action,
} from "./model/sheet.js";
import { indexToCol } from "./model/formula.js";

const LC_KEY = "continuum-tables";
const CELL_W = 96;
const CELL_H = 26;

interface Pos {
  c: number;
  r: number;
}

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
  const filled = cells.map((m) => m.size);

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

  // ── selection and editing (no history worth keeping — plain behaviors) ───
  const [selected, select] = newBehavior<Pos>({ c: 0, r: 0 });
  const [editing, setEditing] = newBehavior(false);
  const [draft, setDraft] = newBehavior("");

  const selectedId = selected.map((p) => cellId(p.c, p.r));
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
    if (move) moveSelection(move.c, move.r);
  };
  const cancel = () => setEditing(false);
  const moveSelection = (dc: number, dr: number) => {
    const p = selected.sample();
    select({
      c: Math.min(COLS - 1, Math.max(0, p.c + dc)),
      r: Math.min(ROWS - 1, Math.max(0, p.r + dr)),
    });
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
      moveSelection(d.c, d.r);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      dispatch({ type: "edit", id: selectedId.sample(), raw: "" });
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

  // ── static grid: built once, kept alive by ~5 000 pinpoint bindings ──────
  const headerCells = Array.from({ length: COLS }, (_, c) => (
    <div class="cell head">{indexToCol(c + 1)}</div>
  ));

  const rows = Array.from({ length: ROWS }, (_, r) => (
    <div class="row">
      <div class="cell head rowhead">{r + 1}</div>
      {Array.from({ length: COLS }, (_, c) => {
        const id = cellId(c, r);
        const text = computed.map((m) => format(m.get(id)));
        const cls: Reactive<string> = selected.map((p) =>
          p.c === c && p.r === r ? "cell active" : "cell",
        );
        return (
          <div
            class={cls}
            data-id={id}
            onMousedown={(e) => {
              e.preventDefault(); // keep focus on the grid
              commit(null);
              select({ c, r });
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
      <header class="toolbar">
        <span class="logo">Continuum Tables</span>
        <button
          class="tool"
          title="Undo (Ctrl+Z)"
          disabled={canUndo.map((v) => !v)}
          onClick={() => dispatch({ type: "undo" })}
        >
          ↩
        </button>
        <button
          class="tool"
          title="Redo (Ctrl+Shift+Z)"
          disabled={canRedo.map((v) => !v)}
          onClick={() => dispatch({ type: "redo" })}
        >
          ↪
        </button>
        <span class="hint">=A1+B2 · SUM(A1:B9) · AVG · MIN · MAX · COUNT</span>
      </header>

      <div class="formula-bar">
        <span class="cell-name">{selectedId}</span>
        <input
          class="formula-input"
          placeholder="Type a value or =formula"
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
              // derived INSIDE the region that uses it: the region's scope owns
              // it, so closing the editor disposes it and reopening derives a
              // fresh one (a component-level derivation would die with its
              // last listener on the first close). Geometry is arithmetic —
              // fixed cell metrics, +1 for the sticky headers.
              style={selected.map(
                (p) =>
                  `left:${(p.c + 1) * CELL_W}px;top:${(p.r + 1) * CELL_H}px;` +
                  `width:${CELL_W}px;height:${CELL_H}px`,
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
        <span>cells filled: {filled}</span>
        <span class="spacer"></span>
        <span>persisted to localStorage · open a second tab to see sync</span>
      </footer>
    </div>
  );
}
