// The grid: sticky headers (click = select the column/row, drag the edge =
// resize), ~2 500 statically built cells with three pinpoint bindings each
// (text, selection class, format style), and the editor overlay.

import { Behavior } from "@continuum-js/frp";
import { Show, onMount } from "@continuum-js/dom";
import type { Events } from "@continuum-js/dom";
import { COLS, ROWS, cellId, format, inRect, styleOf } from "../model/sheet.js";
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
  onKeydown: (e: Events.KeyboardEvent<HTMLDivElement>) => void;
  onEditorKeydown: (e: Events.KeyboardEvent<HTMLInputElement>) => void;
  gridRef: (el: HTMLDivElement) => void;
}) {
  const { selection, editor, layout } = props;

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

  const rows = Array.from({ length: ROWS }, (_, r) => (
    <div class="row" style={`height:var(--h${r})`}>
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
      ref={props.gridRef}
      onKeydown={props.onKeydown}
    >
      <div class="row" style={`height:${HEAD_H}px`}>
        <div class="cell head corner"></div>
        {headerCells}
      </div>
      {rows}

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
}) {
  const { c, r, sheet, selection, editor } = props;
  const id = cellId(c, r);

  const text = sheet.computed.map((m) => format(m.get(id)));
  const cls = Behavior.lift2(
    (a, rect) => {
      const active = a.c === c && a.r === r;
      const inSel = inRect(rect, c, r);
      return `cell${active ? " active" : inSel ? " in-range" : ""}`;
    },
    selection.anchor,
    selection.rect,
  );
  const style = sheet.formats.map((f) => {
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
        editor.commit(null);
        if (e.shiftKey) selection.extendTo({ c, r });
        else selection.beginDrag({ c, r });
      }}
      onMouseenter={() => selection.dragOver({ c, r })}
      onDblclick={() => editor.start()}
    >
      {text}
    </div>
  );
}
