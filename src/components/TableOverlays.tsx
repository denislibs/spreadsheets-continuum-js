// Grid overlays owned by the tables feature: the select-cell dropdown, and —
// for the active table — the name chip with its menu, the per-column ▾
// menus (change type / sort / insert right / delete) and the «+» add-column
// chip. Everything positions itself by prefix sums over the dynamic
// widths/heights and rebuilds via Dynamic when the active table changes.

import { Behavior } from "@continuum-js/frp";
import { Show, Dynamic } from "@continuum-js/dom";
import type { Tables } from "../composables/createTables.js";
import type { Table, ColumnKind } from "../model/tables.js";
import { HEAD_W, HEAD_H, type Layout } from "../composables/createLayout.js";
import { IconChevron, IconPlus } from "../icons.js";

const left = (ws: number[], c: number) =>
  HEAD_W + ws.slice(0, c).reduce((a, b) => a + b, 0);
const top = (hs: number[], r: number) =>
  HEAD_H + hs.slice(0, r).reduce((a, b) => a + b, 0);

const HEADER_COLORS = ["#3d5a45", "#0b57d0", "#7b1fa2", "#5f6368", "#a52714"];

const KINDS: Array<[ColumnKind, string]> = [
  ["text", "Текст"],
  ["person", "Персона"],
  ["select", "Раскрывающийся список"],
  ["number", "Число"],
  ["percent", "Процент"],
  ["notes", "Примечания"],
];

export function TableOverlays(props: { tables: Tables; layout: Layout }) {
  const { tables, layout } = props;

  return (
    <>
      {/* the one global dropdown for select-kind cells */}
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

      {/* everything anchored to the ACTIVE table */}
      <Dynamic value={tables.active}>
        {(t) => (t ? <ActiveTableChrome t={t} {...props} /> : null)}
      </Dynamic>
    </>
  );
}

function ActiveTableChrome(props: {
  t: Table;
  tables: Tables;
  layout: Layout;
}) {
  const { t, tables, layout } = props;
  const at = (c: number, dTop: number) =>
    Behavior.lift2(
      (ws, hs) => `left:${left(ws, c)}px;top:${top(hs, t.anchor.r) + dTop}px`,
      layout.widths,
      layout.heights,
    );

  return (
    <>
      {/* ── the name chip above the header band ─────────────────────────── */}
      <div
        class="tname"
        style={Behavior.lift3(
          (ws, hs, _r) =>
            `left:${left(ws, t.anchor.c)}px;` +
            `top:${top(hs, t.anchor.r) - 23}px;` +
            `background:${t.headerColor ?? "#3d5a45"}`,
          layout.widths,
          layout.heights,
          tables.renaming,
        )}
        onMousedown={(e) => e.stopPropagation()}
      >
        <Show
          when={tables.renaming}
          fallback={() => <span class="tname-label">{t.name}</span>}
        >
          {() => (
            <input
              class="tname-input"
              value={t.name}
              onKeydown={(e) => {
                if (e.key === "Enter") {
                  tables.commitRename(t.id, e.currentTarget.value);
                } else if (e.key === "Escape") tables.closeMenus();
              }}
              onBlur={(e) => tables.commitRename(t.id, e.currentTarget.value)}
              ref={(el) => {
                setTimeout(() => el.select(), 0);
              }}
            />
          )}
        </Show>
        <button class="tname-dd" onClick={tables.toggleTableMenu}>
          <IconChevron />
        </button>
      </div>

      {/* the table menu (screenshot: rename / header color / delete) */}
      <Show when={tables.tableMenuOpen}>
        {() => (
          <div
            class="dropdown tmenu"
            style={at(t.anchor.c, 2)}
            onMousedown={(e) => e.stopPropagation()}
          >
            <button class="dd-item" onClick={tables.startRename}>
              Переименовать таблицу
            </button>
            <div class="dd-sep"></div>
            <div class="tmenu-colors">
              <span class="tmenu-label">Цвет заголовка</span>
              {HEADER_COLORS.map((c) => (
                <button
                  class="swatch"
                  style={`background:${c}`}
                  title={c}
                  onClick={() => tables.setColor(t.id, c)}
                ></button>
              ))}
            </div>
            <div class="dd-sep"></div>
            <button class="dd-item" onClick={() => tables.remove(t.id)}>
              Удалить таблицу
            </button>
          </div>
        )}
      </Show>

      {/* ── per-column ▾ buttons on the header band ─────────────────────── */}
      {t.columns.map((_, i) => (
        <button
          class="th-dd"
          style={Behavior.lift2(
            (ws, hs) =>
              `left:${left(ws, t.anchor.c + i + 1) - 20}px;` +
              `top:${top(hs, t.anchor.r) + 4}px`,
            layout.widths,
            layout.heights,
          )}
          onMousedown={(e) => e.stopPropagation()}
          onClick={() => tables.toggleColMenu(i)}
        >
          <IconChevron />
        </button>
      ))}

      {/* the column menu (screenshot: type / sort / insert / delete) */}
      <Dynamic value={tables.colMenu}>
        {(col) =>
          col !== null && (
            <div
              class="dropdown colmenu"
              style={at(t.anchor.c + col, HEAD_H - 4)}
              onMousedown={(e) => e.stopPropagation()}
            >
              <span class="tmenu-label">Изменить тип столбца</span>
              {KINDS.map(([kind, label]) => (
                <button
                  class={
                    t.columns[col].kind === kind ? "dd-item on" : "dd-item"
                  }
                  onClick={() => tables.setKind(t.id, col, kind)}
                >
                  {label}
                </button>
              ))}
              <div class="dd-sep"></div>
              <button
                class="dd-item"
                onClick={() => tables.sort(t.id, col, "asc")}
              >
                Сортировать столбец А → Я
              </button>
              <button
                class="dd-item"
                onClick={() => tables.sort(t.id, col, "desc")}
              >
                Сортировать столбец Я → А
              </button>
              <div class="dd-sep"></div>
              <button
                class="dd-item"
                onClick={() => tables.insertColumn(t.id, col)}
              >
                Вставить столбец таблицы справа
              </button>
              <button
                class="dd-item"
                onClick={() => tables.removeColumn(t.id, col)}
              >
                Удалить столбец таблицы
              </button>
            </div>
          )
        }
      </Dynamic>

      {/* ── «+»: a new column to the right of the table ─────────────────── */}
      <button
        class="tplus"
        title="Добавить столбец справа"
        style={Behavior.lift2(
          (ws, hs) =>
            `left:${left(ws, t.anchor.c + t.columns.length) + 3}px;` +
            `top:${top(hs, t.anchor.r) + 1}px`,
          layout.widths,
          layout.heights,
        )}
        onMousedown={(e) => e.stopPropagation()}
        onClick={() => tables.insertColumn(t.id, t.columns.length - 1)}
      >
        <IconPlus />
      </button>

      {/* ── «добавить строки» under the table ───────────────────────────── */}
      <div
        class="add-rows"
        style={Behavior.lift2(
          (ws, hs) =>
            `left:${left(ws, t.anchor.c)}px;` +
            `top:${top(hs, t.anchor.r + t.rows + 1) + 3}px`,
          layout.widths,
          layout.heights,
        )}
      >
        <button
          class="add-rows-btn"
          onMousedown={(e) => e.preventDefault()}
          onClick={() => tables.addRows(t.id, 10)}
        >
          Добавьте <b>10</b> строк внизу
        </button>
      </div>
    </>
  );
}
