// The grid: sticky headers (click = select the column/row, drag the edge =
// resize), ~2 500 statically built cells with three pinpoint bindings each
// (text, selection class, format style), and the editor overlay.

import { Behavior } from "@continuum-js/frp";
import { Show, Dynamic, onMount } from "@continuum-js/dom";
import { distinctB } from "@continuum-js/std";
import type { Events } from "@continuum-js/dom";
import {
  COLS,
  ROWS,
  cellId,
  display,
  inRect,
  isUrl,
  styleOf,
} from "../model/sheet.js";
import { optionColor } from "../model/tables.js";
import type { Tables } from "../composables/createTables.js";
import { TableOverlays } from "./TableOverlays.js";
import { indexToCol } from "../model/formula.js";
import type { Sheet } from "../composables/createSheet.js";
import type { Selection } from "../composables/createSelection.js";
import type { Editor } from "../composables/createEditor.js";
import { HEAD_W, HEAD_H, type Layout } from "../composables/createLayout.js";

export function Grid(props: {
  sheet: Sheet;
  selection: Selection;
  editor: Editor;
  layout: Layout;
  tables: Tables;
  onKeydown: (e: Events.KeyboardEvent<HTMLDivElement>) => void;
  onEditorKeydown: (e: Events.KeyboardEvent<HTMLInputElement>) => void;
  gridRef: (el: HTMLDivElement) => void;
}) {
  const { sheet, selection, editor, layout } = props;

  const headerCells = Array.from({ length: COLS }, (_, c) => (
    <div
      class={selection.rect.map((rect) =>
        c >= rect.c1 && c <= rect.c2 ? "cell head col-on" : "cell head",
      )}
      style={`flex-basis:var(--w${c})`}
      onMousedown={(e) => {
        e.preventDefault();
        editor.commit(null);
        selection.selectColumn(c); // click the letter → the whole column
      }}
    >
      {indexToCol(c + 1)}
      <div
        class="col-resizer"
        onMousedown={(e) => layout.startColResize(c, e)}
      ></div>
    </div>
  ));

  // A row that carries a table's header is position:sticky — the WHOLE row
  // pins (its number included), and near the table's end the shrinking top
  // offset slides it up under the letters row, exactly like Sheets. z-index
  // 27: above other rows' number cells (26), under the letters row (28).
  const rowStyle = (r: number) =>
    distinctB(
      Behavior.lift3(
        (ts, hs, st) => {
          const base = `height:var(--h${r})`;
          const t = ts.find((x) => x.anchor.r === r);
          if (!t) return base;
          const end =
            HEAD_H +
            hs.slice(0, t.anchor.r + t.rows + 1).reduce((a, b) => a + b, 0);
          const top = Math.min(HEAD_H, end - st - hs[r]);
          return `${base};position:sticky;top:${top}px;z-index:27`;
        },
        props.tables.list,
        layout.heights,
        layout.scrollTop,
      ),
    );

  const rows = Array.from({ length: ROWS }, (_, r) => (
    <div class="row" style={rowStyle(r)}>
      <div
        class={selection.rect.map((rect) =>
          r >= rect.r1 && r <= rect.r2
            ? "cell head rowhead col-on"
            : "cell head rowhead",
        )}
        onMousedown={(e) => {
          e.preventDefault();
          editor.commit(null);
          selection.selectRow(r); // click the number → the whole row
        }}
      >
        {r + 1}
        <div
          class="row-resizer"
          onMousedown={(e) => layout.startRowResize(r, e)}
        ></div>
      </div>
      {Array.from({ length: COLS }, (_, c) => (
        <Cell key={cellId(c, r)} c={c} r={r} {...props} />
      ))}
    </div>
  ));

  return (
    <div
      class="grid"
      tabindex={0}
      style={layout.gridStyle}
      ref={(el) => {
        props.gridRef(el);
        layout.trackScroll(el);
      }}
      onKeydown={props.onKeydown}
    >
      <div class="row" style={`height:${HEAD_H}px`}>
        <div class="cell head corner"></div>
        {headerCells}
      </div>
      {rows}

      <TableOverlays tables={props.tables} layout={layout} />

      {/* the link chip: a real <a> under the selected cell's URL */}
      <Dynamic
        value={Behavior.lift2(
          (a, m) => {
            const v = m.get(cellId(a.c, a.r));
            return isUrl(v) ? { pos: a, url: String(v) } : null;
          },
          selection.anchor,
          sheet.computed,
        )}
      >
        {(l) =>
          l && (
            <a
              class="link-chip"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              style={Behavior.lift2(
                (ws, hs) =>
                  `left:${HEAD_W + ws.slice(0, l.pos.c).reduce((a2, b) => a2 + b, 0)}px;` +
                  `top:${HEAD_H + hs.slice(0, l.pos.r + 1).reduce((a2, b) => a2 + b, 0) + 2}px`,
                layout.widths,
                layout.heights,
              )}
              onMousedown={(e) => e.stopPropagation()}
            >
              Открыть: {l.url.length > 40 ? l.url.slice(0, 40) + "…" : l.url}
            </a>
          )
        }
      </Dynamic>

      <Show when={editor.editing}>
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
              selection.anchor,
              layout.widths,
              layout.heights,
            )}
            value={editor.draft}
            onInput={(e) => editor.setDraft(e.currentTarget.value)}
            onKeydown={props.onEditorKeydown}
            onBlur={() => editor.commit(null)}
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
  );
}

function Cell(props: {
  key?: string;
  c: number;
  r: number;
  sheet: Sheet;
  selection: Selection;
  editor: Editor;
  tables: Tables;
}) {
  const { c, r, sheet, selection, editor, tables } = props;
  const id = cellId(c, r);
  const pres = tables.presentation.map((p) => p.get(id));

  // a table header shows the column name; everything else shows the value
  // through its number format
  const text = Behavior.lift3(
    (m, p, f) =>
      p?.kind === "header" ? p.label : display(m.get(id), f.get(id)),
    sheet.computed,
    pres,
    sheet.formats,
  );
  const cls = Behavior.lift3(
    (a, rect, p) => {
      const active = a.c === c && a.r === r;
      const inSel = inRect(rect, c, r);
      let s = `cell${active ? " active" : inSel ? " in-range" : ""}`;
      if (p) s += ` t-${p.kind}`;
      if (p?.kind === "header") s += ` th-${p.colKind}`;
      return s;
    },
    selection.anchor,
    selection.rect,
    pres,
  );
  // URL values render as links (see the .t-link style + the LinkChip overlay)
  const isLink = sheet.computed.map((m) => isUrl(m.get(id)));
  // format layer + the table layer (header band, status chip colors)
  const style = Behavior.lift3(
    (f, p, m) => {
      let extra = styleOf(f.get(id));
      if (p?.kind === "header") {
        extra += `${extra ? ";" : ""}background:${p.color}`;
      }
      if (p?.kind === "select") {
        const color = optionColor(p.options, String(m.get(id) ?? ""));
        if (color) extra += `${extra ? ";" : ""}background:${color}`;
      }
      return `flex-basis:var(--w${c})${extra ? ";" + extra : ""}`;
    },
    sheet.formats,
    pres,
    sheet.computed,
  );

  return (
    <div
      class={Behavior.lift2((s, l) => (l ? s + " t-link" : s), cls, isLink)}
      data-id={id}
      style={style}
      onMousedown={(e) => {
        e.preventDefault(); // keep focus on the grid
        editor.commit(null);
        tables.closeSelect();
        if (e.shiftKey) selection.extendTo({ c, r });
        else selection.beginDrag({ c, r });
        const p = tables.presentation.sample().get(id);
        if (p?.kind === "select") tables.showSelect({ c, r }, p.options);
      }}
      onMouseenter={() => selection.dragOver({ c, r })}
      onDblclick={() => editor.start()}
    >
      {text}
    </div>
  );
}
