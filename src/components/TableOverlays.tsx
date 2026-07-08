// Grid overlays owned by the tables feature: the one global dropdown for
// select-kind cells, and the «добавить строки» chip under the active table.
// Both position themselves by prefix sums over the dynamic widths/heights.

import { Behavior } from "@continuum-js/frp";
import { Show, Dynamic } from "@continuum-js/dom";
import type { Tables } from "../composables/createTables.js";
import { HEAD_W, HEAD_H, type Layout } from "../composables/createLayout.js";

const left = (ws: number[], c: number) =>
  HEAD_W + ws.slice(0, c).reduce((a, b) => a + b, 0);
const top = (hs: number[], r: number) =>
  HEAD_H + hs.slice(0, r).reduce((a, b) => a + b, 0);

export function TableOverlays(props: { tables: Tables; layout: Layout }) {
  const { tables, layout } = props;

  return (
    <>
      <Dynamic value={tables.openSelect}>
        {(o) =>
          o && (
            <div
              class="select-dd"
              style={Behavior.lift2(
                (ws, hs) =>
                  `left:${left(ws, o.pos.c)}px;top:${top(hs, o.pos.r + 1)}px`,
                layout.widths,
                layout.heights,
              )}
              onMousedown={(e) => e.stopPropagation()}
            >
              {o.options.map((opt) => (
                <button
                  class="select-opt"
                  onClick={() => tables.choose(o.pos, opt.label)}
                >
                  <span class="chip" style={`background:${opt.color}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
              <button
                class="select-opt clear"
                onClick={() => tables.choose(o.pos, "")}
              >
                Очистить
              </button>
            </div>
          )
        }
      </Dynamic>

      <Show when={tables.active.map((t) => t !== undefined)}>
        {() => (
          <div
            class="add-rows"
            style={Behavior.lift3(
              (t, ws, hs) =>
                t
                  ? `left:${left(ws, t.anchor.c)}px;` +
                    `top:${top(hs, t.anchor.r + t.rows + 1) + 3}px`
                  : "",
              tables.active,
              layout.widths,
              layout.heights,
            )}
          >
            <button
              class="add-rows-btn"
              onMousedown={(e) => e.preventDefault()}
              onClick={() => {
                const t = tables.active.sample();
                if (t) tables.addRows(t.id, 10);
              }}
            >
              Добавьте <b>10</b> строк внизу
            </button>
          </div>
        )}
      </Show>
    </>
  );
}
