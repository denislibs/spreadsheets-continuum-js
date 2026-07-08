// Grid overlays owned by the tables feature: the select-cell dropdown, and —
// for the active table — the name chip with its menu, the per-column ▾
// menus (change type / sort / insert right / delete) and the «+» add-column
// chip. Everything positions itself by prefix sums over the dynamic
// widths/heights and rebuilds via Dynamic when the active table changes.

import { Behavior, newBehavior } from "@continuum-js/frp";
import { Show, Dynamic } from "@continuum-js/dom";
import type { Tables } from "../composables/createTables.js";
import type { Table, ColumnKind, SelectOption } from "../model/tables.js";
import { dateLabel, type Pos } from "../model/sheet.js";
import { HEAD_W, HEAD_H, type Layout } from "../composables/createLayout.js";
import { IconChevron, IconPlus, IconClose } from "../icons.js";

const left = (ws: number[], c: number) =>
  HEAD_W + ws.slice(0, c).reduce((a, b) => a + b, 0);
const top = (hs: number[], r: number) =>
  HEAD_H + hs.slice(0, r).reduce((a, b) => a + b, 0);

const HEADER_COLORS = ["#3d5a45", "#0b57d0", "#7b1fa2", "#5f6368", "#a52714"];

// where the table's header row visually sits: its natural position, or —
// since the row itself is position:sticky (see Grid's rowStyle) — pinned
// under the column letters and pushed out by the table's end. The ▾ buttons,
// «+» and the menus are absolute overlays, so they follow this same math.
const bandY = (t: Table, hs: number[], st: number) => {
  const natural = top(hs, t.anchor.r);
  const end = top(hs, t.anchor.r + t.rows + 1);
  return Math.min(Math.max(natural, st + HEAD_H), end - hs[t.anchor.r]);
};

const KINDS: Array<[ColumnKind, string]> = [
  ["text", "Текст"],
  ["person", "Персона"],
  ["select", "Раскрывающийся список"],
  ["date", "Дата"],
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

      {/* a live outline around every table (footer row included when on) */}
      <Dynamic value={tables.list}>
        {(list) =>
          list.map((t) => (
            <>
              <div
                class="table-outline"
                style={Behavior.lift2(
                  (ws, hs) => {
                    const w = t.columns.reduce(
                      (a, _, i) => a + ws[t.anchor.c + i],
                      0,
                    );
                    const foot = t.fmt?.footer
                      ? hs[t.anchor.r + t.rows + 1]
                      : 0;
                    const h =
                      top(hs, t.anchor.r + t.rows + 1) -
                      top(hs, t.anchor.r) +
                      foot;
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
              {t.fmt?.footer && (
                <div
                  class="table-footer"
                  style={Behavior.lift2(
                    (ws, hs) => {
                      const w = t.columns.reduce(
                        (a, _, i) => a + ws[t.anchor.c + i],
                        0,
                      );
                      const y = top(hs, t.anchor.r + t.rows + 1);
                      return (
                        `left:${left(ws, t.anchor.c)}px;top:${y}px;` +
                        `width:${w}px;height:${hs[t.anchor.r + t.rows + 1]}px`
                      );
                    },
                    layout.widths,
                    layout.heights,
                  )}
                >
                  Строк: {t.rows}
                </div>
              )}
            </>
          ))
        }
      </Dynamic>

      {/* the calendar overlay for date-kind cells */}
      <Dynamic value={tables.openDate}>
        {(pos) => pos && <DatePicker pos={pos} {...props} />}
      </Dynamic>

      {/* everything anchored to the ACTIVE table */}
      <Dynamic value={tables.active}>
        {(t) => (t ? <ActiveTableChrome t={t} {...props} /> : null)}
      </Dynamic>
    </>
  );
}

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
const WEEKDAYS = ["П", "В", "С", "Ч", "П", "С", "В"];

// the Sheets-style calendar under a date cell: month grid (Monday first),
// ‹ › navigation and «Сегодня»
function DatePicker(props: { pos: Pos; tables: Tables; layout: Layout }) {
  const { pos, tables, layout } = props;
  const today = new Date();
  const [view, setView] = newBehavior({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const shift = (d: number) => {
    const v = view.sample();
    const next = new Date(v.y, v.m + d, 1);
    setView({ y: next.getFullYear(), m: next.getMonth() });
  };

  return (
    <div
      class="date-dd"
      style={Behavior.lift2(
        (ws, hs) => `left:${left(ws, pos.c)}px;top:${top(hs, pos.r + 1)}px`,
        layout.widths,
        layout.heights,
      )}
      onMousedown={(e) => e.stopPropagation()}
    >
      <Dynamic value={view}>
        {(v) => {
          const first = new Date(v.y, v.m, 1);
          const start = 1 - ((first.getDay() + 6) % 7); // back to Monday
          const days = Array.from(
            { length: 42 },
            (_, i) => new Date(v.y, v.m, start + i),
          );
          return (
            <>
              <div class="dp-head">
                <span class="dp-title">
                  {MONTHS[v.m]} {v.y} г.
                </span>
                <button class="dp-nav dp-prev" onClick={() => shift(-1)}>
                  ‹
                </button>
                <button class="dp-nav dp-next" onClick={() => shift(1)}>
                  ›
                </button>
              </div>
              <div class="dp-grid">
                {WEEKDAYS.map((w) => (
                  <span class="dp-wd">{w}</span>
                ))}
                {days.map((d) => {
                  const other = d.getMonth() !== v.m;
                  const isToday = dateLabel(d) === dateLabel(today);
                  return (
                    <button
                      class={`dp-day${other ? " other" : ""}${isToday ? " today" : ""}`}
                      onClick={() => tables.pickDate(pos, dateLabel(d))}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <button
                class="dp-today"
                onClick={() => tables.pickDate(pos, dateLabel(today))}
              >
                Сегодня
              </button>
            </>
          );
        }}
      </Dynamic>
    </div>
  );
}

function ActiveTableChrome(props: {
  t: Table;
  tables: Tables;
  layout: Layout;
}) {
  const { t, tables, layout } = props;
  const at = (c: number, dTop: (hs: number[]) => number) =>
    Behavior.lift3(
      (ws, hs, st) =>
        `left:${left(ws, c)}px;top:${bandY(t, hs, st) + dTop(hs)}px`,
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
          (ws, hs, st) => {
            // above the header when there's room; with none (a table at
            // row 1, or pinned under the letters) it becomes a tab on the
            // header's top-left and rides the sticky row, like Sheets
            const natural = top(hs, t.anchor.r) - 23;
            const y = natural >= st + HEAD_H ? natural : bandY(t, hs, st);
            return (
              `left:${left(ws, t.anchor.c)}px;top:${y}px;` +
              `background:${t.headerColor ?? "#3d5a45"}`
            );
          },
          layout.widths,
          layout.heights,
          layout.scrollTop,
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

      {/* the table menu: rename / range / color ▸ / formatting ▸ / clear / delete */}
      <Show when={tables.tableMenuOpen}>
        {() => {
          const [sub, setSub] = newBehavior<"color" | "fmt" | null>(null);
          const flip = (patch: Partial<NonNullable<Table["fmt"]>>) =>
            tables.setFormat(t.id, patch);
          const toggleItem = (label: string, on: boolean, run: () => void) => (
            <button class="dd-item" onClick={run}>
              <span class="dd-check">{on ? "✓" : ""}</span>
              <span class="dd-label">{label}</span>
            </button>
          );
          return (
            <div
              class="dropdown tmenu"
              style={at(t.anchor.c, () => 24)}
              onMousedown={(e) => e.stopPropagation()}
            >
              <button
                class="dd-item"
                onMouseenter={() => setSub(null)}
                onClick={tables.startRename}
              >
                Переименовать таблицу
              </button>
              <button
                class="dd-item"
                disabled
                onMouseenter={() => setSub(null)}
              >
                Изменить диапазон таблицы
              </button>
              <div
                class="dd-item dd-parent"
                onMouseenter={() => setSub("color")}
              >
                <span class="dd-label">Цвет заголовка таблицы</span>
                <span class="dd-arrow">▸</span>
                <Show when={sub.map((x) => x === "color")}>
                  {() => (
                    <div class="dropdown dd-sub tmenu-colors">
                      {HEADER_COLORS.map((c) => (
                        <button
                          class="swatch"
                          style={`background:${c}`}
                          title={c}
                          onClick={() => tables.setColor(t.id, c)}
                        ></button>
                      ))}
                    </div>
                  )}
                </Show>
              </div>
              <div class="dd-item dd-parent" onMouseenter={() => setSub("fmt")}>
                <span class="dd-label">Форматирование таблицы</span>
                <span class="dd-arrow">▸</span>
                <Show when={sub.map((x) => x === "fmt")}>
                  {() => (
                    <div class="dropdown dd-sub">
                      {toggleItem(
                        "Показать линии сетки таблицы",
                        t.fmt?.grid !== false,
                        () => flip({ grid: !(t.fmt?.grid !== false) }),
                      )}
                      {toggleItem(
                        "Показать чередующиеся цвета",
                        !!t.fmt?.banded,
                        () => flip({ banded: !t.fmt?.banded }),
                      )}
                      {toggleItem("Компактный вид", !!t.fmt?.compact, () =>
                        flip({ compact: !t.fmt?.compact }),
                      )}
                      {toggleItem(
                        "Показать нижний колонтитул таблицы",
                        !!t.fmt?.footer,
                        () => flip({ footer: !t.fmt?.footer }),
                      )}
                      <div class="dd-sep"></div>
                      <button class="dd-item" disabled>
                        Посмотреть расширенные параметры
                      </button>
                    </div>
                  )}
                </Show>
              </div>
              <div class="dd-sep"></div>
              <button
                class="dd-item"
                onMouseenter={() => setSub(null)}
                onClick={() => tables.clearDataFormats(t)}
              >
                Отменить форматирование данных
              </button>
              <button
                class="dd-item"
                onMouseenter={() => setSub(null)}
                onClick={() => tables.remove(t.id)}
              >
                Удалить таблицу
              </button>
            </div>
          );
        }}
      </Show>

      {/* ── per-column ▾ buttons: they ride the sticky header row ───────── */}
      {t.columns.map((_, i) => (
        <button
          class="th-dd"
          style={Behavior.lift3(
            (ws, hs, st) =>
              `left:${left(ws, t.anchor.c + i + 1) - 20}px;` +
              `top:${bandY(t, hs, st) + hs[t.anchor.r] - 21}px`,
            layout.widths,
            layout.heights,
            layout.scrollTop,
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
              style={at(t.anchor.c + col, (hs) => hs[t.anchor.r] - 4)}
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
        style={Behavior.lift3(
          (ws, hs, st) =>
            `left:${left(ws, t.anchor.c + t.columns.length) + 3}px;` +
            `top:${bandY(t, hs, st) + Math.round((hs[t.anchor.r] - 22) / 2)}px`,
          layout.widths,
          layout.heights,
          layout.scrollTop,
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
          (ws, hs) => {
            const foot = t.fmt?.footer ? hs[t.anchor.r + t.rows + 1] : 0;
            return (
              `left:${left(ws, t.anchor.c)}px;` +
              `top:${top(hs, t.anchor.r + t.rows + 1) + foot + 3}px`
            );
          },
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
