// Grid overlays owned by the tables feature: the select-cell dropdown, and —
// for the active table — the name chip with its menu, the per-column ▾
// menus (change type / sort / insert right / delete) and the «+» add-column
// chip. Everything positions itself by prefix sums over the dynamic
// widths/heights and rebuilds via Dynamic when the active table changes.

import { Behavior, newBehavior } from "@continuum-js/frp";
import { Show, Dynamic } from "@continuum-js/dom";
import type { Tables } from "../composables/createTables.js";
import type { Table, ColumnKind, SelectOption } from "../model/tables.js";
import { HEAD_W, HEAD_H, type Layout } from "../composables/createLayout.js";
import { IconChevron, IconPlus, IconClose } from "../icons.js";

const left = (ws: number[], c: number) =>
  HEAD_W + ws.slice(0, c).reduce((a, b) => a + b, 0);
const top = (hs: number[], r: number) =>
  HEAD_H + hs.slice(0, r).reduce((a, b) => a + b, 0);

const HEADER_COLORS = ["#3d5a45", "#0b57d0", "#7b1fa2", "#5f6368", "#a52714"];

// where the header band actually sits: its natural row position, or pinned
// under the sticky column letters while the table scrolls through
const bandY = (t: Table, hs: number[], st: number) => {
  const natural = top(hs, t.anchor.r);
  const end = top(hs, t.anchor.r + t.rows + 1);
  return Math.min(Math.max(natural, st + HEAD_H), end - hs[t.anchor.r]);
};

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

      {/* a live outline around every table: grows with columns/rows/resizes */}
      <Dynamic value={tables.list}>
        {(list) =>
          list.map((t) => (
            <div
              class="table-outline"
              style={Behavior.lift2(
                (ws, hs) => {
                  const w = t.columns.reduce(
                    (a, _, i) => a + ws[t.anchor.c + i],
                    0,
                  );
                  const h =
                    top(hs, t.anchor.r + t.rows + 1) - top(hs, t.anchor.r);
                  return (
                    `left:${left(ws, t.anchor.c)}px;top:${top(hs, t.anchor.r)}px;` +
                    `width:${w}px;height:${h}px;` +
                    `border-color:${t.headerColor ?? "#3d5a45"}`
                  );
                },
                layout.widths,
                layout.heights,
              )}
            ></div>
          ))
        }
      </Dynamic>

      {/* pinned header bands: any table scrolling under the column letters */}
      <Dynamic value={tables.list}>
        {(list) => list.map((t) => <PinnedBand t={t} {...props} />)}
      </Dynamic>

      {/* everything anchored to the ACTIVE table */}
      <Dynamic value={tables.active}>
        {(t) => (t ? <ActiveTableChrome t={t} {...props} /> : null)}
      </Dynamic>
    </>
  );
}

function PinnedBand(props: { t: Table; tables: Tables; layout: Layout }) {
  const { t, tables, layout } = props;
  const style = Behavior.lift3(
    (ws, hs, st) => {
      const y = bandY(t, hs, st);
      const natural = top(hs, t.anchor.r);
      const end = top(hs, t.anchor.r + t.rows + 1);
      if (y <= natural) return "display:none"; // not pinned — the real row shows
      if (st + HEAD_H >= end) return "display:none"; // the table has passed
      const widths = t.columns.map((_, i) => ws[t.anchor.c + i]);
      const total = widths.reduce((a, b) => a + b, 0);
      return (
        `left:${left(ws, t.anchor.c)}px;top:${y}px;` +
        `width:${total}px;height:${hs[t.anchor.r]}px;` +
        `background:${t.headerColor ?? "#3d5a45"};` +
        widths.map((w, i) => `--pb${i}:${w}px`).join(";")
      );
    },
    layout.widths,
    layout.heights,
    layout.scrollTop,
  );
  return (
    <div class="pinned-band" style={style}>
      {t.columns.map((col, i) => (
        <div
          class={`pb-cell t-header th-${col.kind}`}
          style={`flex-basis:var(--pb${i})`}
        >
          {col.name}
          <button
            class="th-dd pb-dd"
            onMousedown={(e) => e.stopPropagation()}
            onClick={() => tables.toggleColMenu(i)}
          >
            <IconChevron />
          </button>
        </div>
      ))}
    </div>
  );
}

function ActiveTableChrome(props: {
  t: Table;
  tables: Tables;
  layout: Layout;
}) {
  const { t, tables, layout } = props;
  const at = (c: number, dTop: number) =>
    Behavior.lift3(
      (ws, hs, st) => `left:${left(ws, c)}px;top:${bandY(t, hs, st) + dTop}px`,
      layout.widths,
      layout.heights,
      layout.scrollTop,
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
              <Show
                when={tables.colMenu.map(
                  () => t.columns[col].kind === "select",
                )}
              >
                {() => (
                  <>
                    <div class="dd-sep"></div>
                    <button
                      class="dd-item"
                      onClick={() => tables.openOptionsEditor(col)}
                    >
                      Изменить варианты…
                    </button>
                  </>
                )}
              </Show>
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

      {/* ── the select-options editor («Правила проверки данных») ───────── */}
      <Dynamic value={tables.optionsEditor}>
        {(col) =>
          col !== null && <OptionsEditor t={t} col={col} tables={tables} />
        }
      </Dynamic>

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

const PALETTE = [
  "#d4edbc",
  "#ffe5a0",
  "#bfe1f6",
  "#ffcfc9",
  "#e6e6e6",
  "#c9b8f9",
];

function OptionsEditor(props: { t: Table; col: number; tables: Tables }) {
  const { t, col, tables } = props;
  // a local draft: edits accumulate here, «Готово» dispatches ONE action
  const [draft, setDraft] = newBehavior<SelectOption[]>(
    (t.columns[col].options ?? []).map((o) => ({ ...o })),
  );
  const update = (i: number, patch: Partial<SelectOption>) =>
    setDraft(draft.sample().map((o, j) => (j === i ? { ...o, ...patch } : o)));

  return (
    <aside class="tables-panel opts" onMousedown={(e) => e.stopPropagation()}>
      <div class="tp-head">
        <span class="tp-title">Правила проверки данных</span>
        <button
          class="tool"
          title="Закрыть"
          onClick={tables.closeOptionsEditor}
        >
          <IconClose />
        </button>
      </div>
      <p class="tp-desc">
        Применить к столбцу:{" "}
        <b>
          {t.name}[{t.columns[col].name}]
        </b>
      </p>
      <Dynamic value={draft}>
        {(opts) => (
          <div class="opts-list">
            {opts.map((o, i) => (
              <div class="opts-row">
                <label class="opts-color" style={`background:${o.color}`}>
                  <input
                    type="color"
                    value={o.color}
                    onInput={(e) => update(i, { color: e.currentTarget.value })}
                  />
                </label>
                <input
                  class="opts-label"
                  value={o.label}
                  onInput={(e) => update(i, { label: e.currentTarget.value })}
                />
                <button
                  class="tool"
                  title="Удалить вариант"
                  onClick={() =>
                    setDraft(draft.sample().filter((_, j) => j !== i))
                  }
                >
                  <IconClose />
                </button>
              </div>
            ))}
          </div>
        )}
      </Dynamic>
      <button
        class="opts-add"
        onClick={() =>
          setDraft([
            ...draft.sample(),
            {
              label: `Вариант ${draft.sample().length + 1}`,
              color: PALETTE[draft.sample().length % PALETTE.length],
            },
          ])
        }
      >
        Добавить объект
      </button>
      <div class="opts-actions">
        <button class="opts-cancel" onClick={tables.closeOptionsEditor}>
          Отмена
        </button>
        <button
          class="opts-done"
          onClick={() =>
            tables.setOptions(
              t.id,
              col,
              draft.sample().filter((o) => o.label.trim()),
            )
          }
        >
          Готово
        </button>
      </div>
    </aside>
  );
}
