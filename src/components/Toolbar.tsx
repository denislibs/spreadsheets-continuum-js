// Row 2 — the Sheets toolbar, group by group: search pill · undo/redo/print/
// paint/zoom · number formats · font/size stepper · text styles/colors ·
// fill/borders/merge · alignment/wrap · the ⋮ overflow with Σ functions.

import { newBehavior } from "@continuum-js/frp";
import { Show, onCleanup, onMount } from "@continuum-js/dom";
import type { Child } from "@continuum-js/dom";
import type { Sheet } from "../composables/createSheet.js";
import type { Editor } from "../composables/createEditor.js";
import type { Formatting, ToggleKey } from "../lib/formatting.js";
import type { BorderKind } from "../model/borders.js";
import {
  IconSearch,
  IconUndo,
  IconRedo,
  IconPrint,
  IconPaint,
  IconPercent,
  IconDecDec,
  IconDecInc,
  IconMinus,
  IconPlus,
  IconBorders,
  IconMerge,
  IconAlignLines,
  IconValign,
  IconWrap,
  IconDots,
  IconSigma,
  IconLink,
  IconFilter,
  IconChartLine,
  IconComment,
  IconChevron,
  IconBAll,
  IconBInner,
  IconBHoriz,
  IconBVert,
  IconBOuter,
  IconBLeft,
  IconBTop,
  IconBRight,
  IconBBottom,
  IconBNone,
} from "../icons.js";

const BORDER_OPTIONS: Array<{
  kind: BorderKind;
  icon: () => Node;
  title: string;
}> = [
  { kind: "all", icon: IconBAll, title: "Все границы" },
  { kind: "inner", icon: IconBInner, title: "Внутренние границы" },
  { kind: "horizontal", icon: IconBHoriz, title: "Горизонтальные границы" },
  { kind: "vertical", icon: IconBVert, title: "Вертикальные границы" },
  { kind: "outer", icon: IconBOuter, title: "Внешние границы" },
  { kind: "left", icon: IconBLeft, title: "Левая граница" },
  { kind: "top", icon: IconBTop, title: "Верхняя граница" },
  { kind: "right", icon: IconBRight, title: "Правая граница" },
  { kind: "bottom", icon: IconBBottom, title: "Нижняя граница" },
  { kind: "none", icon: IconBNone, title: "Очистить границы" },
];

const FNS = ["SUM", "AVG", "MIN", "MAX", "COUNT", "SUMPRODUCT"];

export function Toolbar(props: {
  sheet: Sheet;
  editor: Editor;
  fmt: Formatting;
  setZoom: (z: number) => void;
  focusGrid: () => void;
}) {
  const { sheet, editor, fmt } = props;
  const after = (f: () => void) => () => {
    f();
    props.focusGrid();
  };

  // which toolbar dropdown is open (borders / align / overflow)
  const [openDd, setOpenDd] = newBehavior<string | null>(null);
  onMount(() => {
    const close = () => setOpenDd(null);
    window.addEventListener("mousedown", close);
    onCleanup(() => window.removeEventListener("mousedown", close));
  });
  const toggleDd = (name: string) =>
    setOpenDd(openDd.sample() === name ? null : name);

  const fmtBtn = (key: ToggleKey, label: Child, titleText: string) => (
    <button
      class={fmt.anchorFormat.map((f) => (f[key] ? "tool on" : "tool"))}
      title={titleText}
      onClick={after(() => fmt.toggle(key))}
    >
      {label}
    </button>
  );

  const fontSize = fmt.anchorFormat.map((f) => String(f.fs ?? 13));
  const bumpFont = (d: number) => {
    const cur = Number(fontSize.sample());
    const n = Math.max(6, Math.min(48, cur + d));
    fmt.apply({ fs: n === 13 ? undefined : n });
  };

  return (
    <div class="toolbar">
      <span class="search-pill">
        <IconSearch />
        <span>Меню</span>
      </span>

      <button
        class="tool"
        title="Отменить (Ctrl+Z)"
        disabled={sheet.canUndo.map((v) => !v)}
        onClick={after(() => sheet.dispatch({ type: "undo" }))}
      >
        <IconUndo />
      </button>
      <button
        class="tool"
        title="Повторить (Ctrl+Shift+Z)"
        disabled={sheet.canRedo.map((v) => !v)}
        onClick={after(() => sheet.dispatch({ type: "redo" }))}
      >
        <IconRedo />
      </button>
      <button class="tool" title="Печать" onClick={() => window.print()}>
        <IconPrint />
      </button>
      <button class="tool" title="Копировать форматирование" disabled>
        <IconPaint />
      </button>
      <select
        class="zoom"
        title="Масштаб"
        onChange={(e) => props.setZoom(Number(e.currentTarget.value))}
      >
        <option value="75">75%</option>
        <option value="100" selected>
          100%
        </option>
        <option value="125">125%</option>
        <option value="150">150%</option>
      </select>

      <span class="sep"></span>

      <button
        class={fmt.anchorFormat.map((f) =>
          f.nf === "percent" ? "tool on" : "tool",
        )}
        title="Процентный формат"
        onClick={after(fmt.togglePercent)}
      >
        <IconPercent />
      </button>
      <button
        class="tool"
        title="Уменьшить число знаков после запятой"
        onClick={after(() => fmt.shiftDecimals(-1))}
      >
        <IconDecDec />
      </button>
      <button
        class="tool"
        title="Увеличить число знаков после запятой"
        onClick={after(() => fmt.shiftDecimals(1))}
      >
        <IconDecInc />
      </button>
      <button class="tool num123" title="Другие форматы" disabled>
        123
      </button>

      <span class="sep"></span>

      <select class="zoom font-name" title="Шрифт" disabled>
        <option>По умолчанию</option>
      </select>
      <button
        class="tool"
        title="Уменьшить размер шрифта"
        onClick={after(() => bumpFont(-1))}
      >
        <IconMinus />
      </button>
      <span class="font-size">{fontSize}</span>
      <button
        class="tool"
        title="Увеличить размер шрифта"
        onClick={after(() => bumpFont(1))}
      >
        <IconPlus />
      </button>

      <span class="sep"></span>

      {fmtBtn("b", <b>Ж</b>, "Полужирный (Ctrl+B)")}
      {fmtBtn("i", <i>К</i>, "Курсив (Ctrl+I)")}
      {fmtBtn("s", <s>З</s>, "Зачёркнутый")}
      <label class="tool color" title="Цвет текста">
        <span class="color-glyph">A</span>
        <input
          type="color"
          onInput={(e) => fmt.apply({ fg: e.currentTarget.value })}
        />
      </label>

      <span class="sep"></span>

      <label class="tool color" title="Цвет заливки">
        <span class="color-glyph fill">▧</span>
        <input
          type="color"
          value="#ffff88"
          onInput={(e) => fmt.apply({ bg: e.currentTarget.value })}
        />
      </label>

      <span class="dd-holder">
        <button
          class={openDd.map((o) => (o === "borders" ? "tool on" : "tool"))}
          title="Границы"
          onMousedown={(e) => {
            e.stopPropagation();
            toggleDd("borders");
          }}
        >
          <IconBorders />
        </button>
        <Show when={openDd.map((o) => o === "borders")}>
          {() => (
            <div
              class="dropdown borders-dd"
              onMousedown={(e) => e.stopPropagation()}
            >
              {BORDER_OPTIONS.map((o) => (
                <button
                  class="tool"
                  title={o.title}
                  onClick={after(() => {
                    fmt.applyBorders(o.kind);
                    setOpenDd(null);
                  })}
                >
                  {o.icon()}
                </button>
              ))}
            </div>
          )}
        </Show>
      </span>

      <button class="tool" title="Объединить ячейки" disabled>
        <IconMerge />
        <IconChevron />
      </button>

      <span class="sep"></span>

      <span class="dd-holder">
        <button
          class="tool"
          title="Выравнивание по горизонтали"
          onMousedown={(e) => {
            e.stopPropagation();
            toggleDd("align");
          }}
        >
          {IconAlignLines(10, 16)}
          <IconChevron />
        </button>
        <Show when={openDd.map((o) => o === "align")}>
          {() => (
            <div
              class="dropdown borders-dd"
              onMousedown={(e) => e.stopPropagation()}
            >
              {(
                [
                  ["left", 10, "Слева"],
                  ["center", 16, "По центру"],
                  ["right", 10, "Справа"],
                ] as const
              ).map(([al, w, titleText]) => (
                <button
                  class={fmt.anchorFormat.map((f) =>
                    (f.al ?? "left") === al ? "tool on" : "tool",
                  )}
                  title={titleText}
                  onClick={after(() => {
                    fmt.apply({ al: al === "left" ? undefined : al });
                    setOpenDd(null);
                  })}
                >
                  {IconAlignLines(w, al === "right" ? 16 : 12)}
                </button>
              ))}
            </div>
          )}
        </Show>
      </span>
      <button class="tool" title="Выравнивание по вертикали" disabled>
        <IconValign />
        <IconChevron />
      </button>
      <button
        class={fmt.anchorFormat.map((f) => (f.wr ? "tool on" : "tool"))}
        title="Перенос текста"
        onClick={after(fmt.toggleWrap)}
      >
        <IconWrap />
      </button>

      <span class="sep"></span>

      <span class="dd-holder">
        <button
          class={openDd.map((o) => (o === "more" ? "tool on" : "tool"))}
          title="Ещё"
          onMousedown={(e) => {
            e.stopPropagation();
            toggleDd("more");
          }}
        >
          <IconDots />
        </button>
        <Show when={openDd.map((o) => o === "more")}>
          {() => (
            <div
              class="dropdown more-dd"
              onMousedown={(e) => e.stopPropagation()}
            >
              <div class="more-row">
                <button class="tool" title="Вставить ссылку" disabled>
                  <IconLink />
                </button>
                <button class="tool" title="Комментарий" disabled>
                  <IconComment />
                </button>
                <button class="tool" title="Диаграмма" disabled>
                  <IconChartLine />
                </button>
                <button class="tool" title="Фильтр" disabled>
                  <IconFilter />
                </button>
              </div>
              <div class="dd-sep"></div>
              <div class="more-fns">
                <span class="more-title">
                  <IconSigma /> Функции
                </span>
                {FNS.map((fn) => (
                  <button
                    class="dd-item"
                    onClick={() => {
                      editor.start(`=${fn}(`);
                      setOpenDd(null);
                    }}
                  >
                    {fn}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Show>
      </span>

      <span class="hint">
        <b>=A#*B# — вся колонка</b>
      </span>
    </div>
  );
}
