// Continuum Tables — a Google-Sheets-style app as a stream-first showcase.
//
// The whole architecture is ONE stream of actions folded three ways:
//   actions ──accum──▶ sheet state (cells + formats + undo history)
//              └──────▶ persistence (mirror of the folded value)
//              └──────▶ cross-tab sync (the `storage` event is one more
//                       dispatcher into the same reducer)
// Selection is a rectangle {anchor, focus}; column widths, row heights,
// zoom and the title are plain behaviors (no history worth keeping) with
// their own persistence mirrors. ~2 500 cells × 3 live bindings each.

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
  toCsv,
  styleOf,
  type Action,
  type Formats,
  type CellFormat,
} from "./model/sheet.js";
import { indexToCol } from "./model/formula.js";
import {
  IconStar,
  IconCloud,
  IconClock,
  IconComment,
  IconCam,
  IconPrint,
  IconSearch,
  IconLock,
  IconChevron,
  IconGridLogo,
} from "./icons.js";

const LC_KEY = "continuum-tables";
const DEFAULT_W = 96;
const DEFAULT_H = 26;
const MIN_W = 40;
const MIN_H = 18;
const HEAD_W = 48;
const HEAD_H = 26;

interface Pos {
  c: number;
  r: number;
}

// persisted payload: cells + formats in one key (one storage event → one
// replace action). Older payloads were the bare cells object — migrate.
type Persisted = { c: Record<string, string>; f: Record<string, CellFormat> };
const migrate = (o: Record<string, unknown>): Persisted =>
  "c" in o
    ? (o as unknown as Persisted)
    : { c: o as Record<string, string>, f: {} };

const formatsToPlain = (f: Formats) => Object.fromEntries(f);
const formatsFromPlain = (o: Record<string, CellFormat>): Formats =>
  new Map(Object.entries(o));

export function App() {
  // ── the one stream of actions, folded ─────────────────────────────────────
  const [actions, dispatch] = newStream<Action>();
  const initial = migrate(loadPersisted<Record<string, unknown>>(LC_KEY, {}));
  const state = actions.accum(
    emptySheet(fromPlain(initial.c), formatsFromPlain(initial.f)),
    reduce,
  );
  const cells = state.map((s) => s.cells);
  const formats = state.map((s) => s.formats);
  const computed = cells.map(evalSheet);
  const canUndo = state.map((s) => s.past.length > 0);
  const canRedo = state.map((s) => s.future.length > 0);

  // persistence: a mirror of the folded value (plain objects for JSON)
  onCleanup(
    persist(
      LC_KEY,
      state.map((s): Persisted => ({
        c: toPlain(s.cells),
        f: formatsToPlain(s.formats),
      })),
    ),
  );

  // cross-tab sync: the other tab's write is just one more dispatcher
  onMount(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LC_KEY && e.newValue) {
        const p = migrate(JSON.parse(e.newValue));
        dispatch({
          type: "replace",
          cells: fromPlain(p.c),
          formats: formatsFromPlain(p.f),
        });
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

  const [heights, setHeights] = newBehavior<number[]>(
    loadPersisted(`${LC_KEY}:heights`, Array(ROWS).fill(DEFAULT_H)),
  );
  onCleanup(persist(`${LC_KEY}:heights`, heights));

  const [zoom, setZoom] = newBehavior(100);

  // widths/heights reach the ~2 500 static cells through CSS variables:
  // ONE live binding on the grid instead of one per cell
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

  // ── menus ─────────────────────────────────────────────────────────────────
  const [openMenu, setOpenMenu] = newBehavior<string | null>(null);
  onMount(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("mousedown", close);
    onCleanup(() => window.removeEventListener("mousedown", close));
  });

  const downloadCsv = () => {
    const blob = new Blob(["﻿" + toCsv(computed.sample())], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.sample().trim() || "sheet"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
  const anchorFormat = Behavior.lift2(
    (id, f) => f.get(id) ?? {},
    selectedId,
    formats,
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
  const selectColumn = (c: number) =>
    setSel({ anchor: { c, r: 0 }, focus: { c, r: ROWS - 1 } });
  const selectRow = (r: number) =>
    setSel({ anchor: { c: 0, r }, focus: { c: COLS - 1, r } });

  const isMulti = () => {
    const rect = selRect.sample();
    return rect.c1 !== rect.c2 || rect.r1 !== rect.r2;
  };

  const startEdit = (initial?: string) => {
    setDraft(initial ?? rawOfSelected.sample());
    setEditing(true);
  };
  const commit = (move: Pos | null) => {
    if (editing.sample()) {
      const raw = draft.sample().trim();
      // a multi-cell selection is FILLED with the committed value; column
      // formulas (=A#*B#) go to the anchor — the # template already covers
      // every row by itself
      if (isMulti() && !raw.includes("#")) {
        dispatch({ type: "fill", ids: idsInRect(selRect.sample()), raw });
      } else {
        dispatch({ type: "edit", id: selectedId.sample(), raw });
      }
      setEditing(false);
    }
    if (move) {
      const a = sel.sample().anchor;
      selectOne({ c: a.c + move.c, r: a.r + move.r });
    }
  };
  const cancel = () => setEditing(false);

  // ── formatting: a patch dispatched onto the selected rectangle ───────────
  const applyFormat = (patch: Partial<CellFormat>) => {
    dispatch({ type: "format", ids: idsInRect(selRect.sample()), patch });
    gridEl.focus();
  };
  const toggleFormat = (key: "b" | "i" | "u" | "s") =>
    applyFormat({ [key]: anchorFormat.sample()[key] ? undefined : true });

  // drag state lives at the DOM boundary — nothing renders from it
  let dragging = false;
  onMount(() => {
    const up = () => (dragging = false);
    window.addEventListener("mouseup", up);
    onCleanup(() => window.removeEventListener("mouseup", up));
  });

  // ── column/row resize: imperative drag at the boundary ───────────────────
  const startDrag = (
    e: Events.MouseEvent<HTMLDivElement>,
    onMove: (dx: number, dy: number) => void,
  ) => {
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
  };
  const startColResize = (c: number, e: Events.MouseEvent<HTMLDivElement>) => {
    const w0 = widths.sample()[c];
    startDrag(e, (dx) => {
      const next = [...widths.sample()];
      next[c] = Math.max(MIN_W, w0 + dx);
      setWidths(next);
    });
  };
  const startRowResize = (r: number, e: Events.MouseEvent<HTMLDivElement>) => {
    const h0 = heights.sample()[r];
    startDrag(e, (_dx, dy) => {
      const next = [...heights.sample()];
      next[r] = Math.max(MIN_H, h0 + dy);
      setHeights(next);
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
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleFormat("b");
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      toggleFormat("i");
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
      e.preventDefault();
      toggleFormat("u");
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

  // ── menus: data-driven; Файл and Правка are functional ────────────────────
  type MenuItem =
    | { sep: true }
    | {
        label: string;
        action?: () => void;
        disabled?: boolean | Behavior<boolean>;
      };
  const MENUS: Array<{ name: string; items: MenuItem[] }> = [
    {
      name: "Файл",
      items: [
        {
          label: "Создать",
          action: () =>
            dispatch({ type: "replace", cells: new Map(), formats: new Map() }),
        },
        { label: "Открыть", disabled: true },
        { label: "Создать копию", disabled: true },
        { sep: true },
        { label: "Скачать (.csv)", action: downloadCsv },
        { sep: true },
        { label: "Печать", action: () => window.print() },
      ],
    },
    {
      name: "Правка",
      items: [
        {
          label: "Отменить",
          action: () => dispatch({ type: "undo" }),
          disabled: canUndo.map((v) => !v),
        },
        {
          label: "Повторить",
          action: () => dispatch({ type: "redo" }),
          disabled: canRedo.map((v) => !v),
        },
        { sep: true },
        {
          label: "Удалить значения",
          action: () =>
            dispatch({ type: "clearRange", ids: idsInRect(selRect.sample()) }),
        },
      ],
    },
    { name: "Вид", items: [] },
    { name: "Вставка", items: [] },
    { name: "Формат", items: [] },
    { name: "Данные", items: [] },
    { name: "Инструменты", items: [] },
    { name: "Расширения", items: [] },
    { name: "Справка", items: [] },
  ];

  const menuBar = MENUS.map((m) => (
    <span
      class={openMenu.map((o) =>
        o === m.name ? "menu-item open" : "menu-item",
      )}
      onMousedown={(e) => {
        e.stopPropagation();
        if (m.items.length === 0) return;
        setOpenMenu(openMenu.sample() === m.name ? null : m.name);
      }}
      onMouseenter={() => {
        // Sheets-style: while one menu is open, hovering slides to the next
        if (openMenu.sample() !== null && m.items.length > 0) {
          setOpenMenu(m.name);
        }
      }}
    >
      {m.name}
      {m.items.length > 0 && (
        <Show when={openMenu.map((o) => o === m.name)}>
          {() => (
            <div class="dropdown" onMousedown={(e) => e.stopPropagation()}>
              {m.items.map((it) =>
                "sep" in it ? (
                  <div class="dd-sep"></div>
                ) : (
                  <button
                    class="dd-item"
                    disabled={it.disabled ?? !it.action}
                    onClick={() => {
                      it.action?.();
                      setOpenMenu(null);
                      gridEl.focus();
                    }}
                  >
                    {it.label}
                  </button>
                ),
              )}
            </div>
          )}
        </Show>
      )}
    </span>
  ));

  // a format-toggle button whose pressed state follows the anchor cell
  const fmtBtn = (
    key: "b" | "i" | "u" | "s",
    label: Node | string,
    titleText: string,
  ) => (
    <button
      class={anchorFormat.map((f) => (f[key] ? "tool on" : "tool"))}
      title={titleText}
      onClick={() => toggleFormat(key)}
    >
      {label}
    </button>
  );
  const alignBtn = (al: "left" | "center" | "right", glyph: string) => (
    <button
      class={anchorFormat.map((f) =>
        (f.al ?? "left") === al ? "tool on" : "tool",
      )}
      title={`Выравнивание: ${al}`}
      onClick={() => applyFormat({ al: al === "left" ? undefined : al })}
    >
      {glyph}
    </button>
  );

  // ── static grid: built once, kept alive by pinpoint bindings ─────────────
  const headerCells = Array.from({ length: COLS }, (_, c) => (
    <div
      class={selRect.map((rect) =>
        c >= rect.c1 && c <= rect.c2 ? "cell head col-on" : "cell head",
      )}
      style={`flex-basis:var(--w${c})`}
      onMousedown={(e) => {
        e.preventDefault();
        commit(null);
        selectColumn(c); // click the letter → the whole column
      }}
    >
      {indexToCol(c + 1)}
      <div class="col-resizer" onMousedown={(e) => startColResize(c, e)}></div>
    </div>
  ));

  const rows = Array.from({ length: ROWS }, (_, r) => (
    <div class="row" style={`height:var(--h${r})`}>
      <div
        class={selRect.map((rect) =>
          r >= rect.r1 && r <= rect.r2
            ? "cell head rowhead col-on"
            : "cell head rowhead",
        )}
        onMousedown={(e) => {
          e.preventDefault();
          commit(null);
          selectRow(r); // click the number → the whole row
        }}
      >
        {r + 1}
        <div
          class="row-resizer"
          onMousedown={(e) => startRowResize(r, e)}
        ></div>
      </div>
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
        const style = formats.map((f) => {
          const extra = styleOf(f.get(id));
          return `flex-basis:var(--w${c})${extra ? ";" + extra : ""}`;
        });
        return (
          <div
            class={cls}
            data-id={id}
            style={style}
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
        <div class="sheets-logo">
          <IconGridLogo />
        </div>
        <div class="chrome-main">
          <div class="title-row">
            <input
              class="doc-title"
              value={title}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <span class="chrome-ico" title="Помеченные">
              <IconStar />
            </span>
            <span class="chrome-ico" title="Сохранено на Диске">
              <IconCloud />
            </span>
          </div>
          <nav class="menubar">{menuBar}</nav>
        </div>
        <div class="chrome-right">
          <span class="chrome-ico big" title="История версий">
            <IconClock />
          </span>
          <span class="chrome-ico big" title="Комментарии">
            <IconComment />
          </span>
          <span class="chrome-ico big" title="Видеовстреча">
            <IconCam />
            <IconChevron />
          </span>
          <button class="share">
            <IconLock />
            <span>Настройки Доступа</span>
          </button>
          <div class="avatar" title="Denis">
            D
          </div>
        </div>
      </header>

      {/* ── row 2: toolbar ─────────────────────────────────────────────── */}
      <div class="toolbar">
        <span class="search-pill">
          <IconSearch />
          <span>Меню</span>
        </span>
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
          <IconPrint />
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

        <span class="sep"></span>

        {fmtBtn("b", <b>Ж</b>, "Полужирный (Ctrl+B)")}
        {fmtBtn("i", <i>К</i>, "Курсив (Ctrl+I)")}
        {fmtBtn("u", <u>Ч</u>, "Подчёркнутый (Ctrl+U)")}
        {fmtBtn("s", <s>З</s>, "Зачёркнутый")}
        <select
          class="zoom"
          title="Размер шрифта"
          onChange={(e) => {
            const n = Number(e.currentTarget.value);
            applyFormat({ fs: n === 13 ? undefined : n });
          }}
        >
          {[10, 11, 12, 13, 14, 16, 18, 24].map((n) => (
            <option value={String(n)} selected={n === 13}>
              {n}
            </option>
          ))}
        </select>
        <label class="tool color" title="Цвет текста">
          <span class="color-glyph">A</span>
          <input
            type="color"
            onInput={(e) => applyFormat({ fg: e.currentTarget.value })}
          />
        </label>
        <label class="tool color" title="Цвет заливки">
          <span class="color-glyph fill">▧</span>
          <input
            type="color"
            value="#ffff88"
            onInput={(e) => applyFormat({ bg: e.currentTarget.value })}
          />
        </label>
        <button
          class="tool"
          title="Очистить форматирование"
          onClick={() =>
            applyFormat({
              b: undefined,
              i: undefined,
              u: undefined,
              s: undefined,
              al: undefined,
              fg: undefined,
              bg: undefined,
              fs: undefined,
            })
          }
        >
          ⌫
        </button>

        <span class="sep"></span>

        {alignBtn("left", "⇤")}
        {alignBtn("center", "⇔")}
        {alignBtn("right", "⇥")}

        <span class="hint">
          =A1+B2 · SUM · SUMPRODUCT · <b>=A#*B# — вся колонка</b>
        </span>
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
        <div class="row" style={`height:${HEAD_H}px`}>
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
              // derives a fresh one. Geometry: widths/heights are dynamic,
              // so both offsets are prefix sums (+ the sticky headers).
              style={Behavior.lift3(
                (p, ws, hs) => {
                  const left =
                    HEAD_W + ws.slice(0, p.c).reduce((a, b) => a + b, 0);
                  const top =
                    HEAD_H + hs.slice(0, p.r).reduce((a, b) => a + b, 0);
                  return (
                    `left:${left}px;top:${top}px;` +
                    `width:${ws[p.c]}px;height:${hs[p.r]}px`
                  );
                },
                anchor,
                widths,
                heights,
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
