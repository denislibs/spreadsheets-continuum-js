// Row 2: undo/redo/print/zoom plus the formatting cluster. Everything acts
// through the sheet's action stream and the formatting facade.

import type { Sheet } from "../composables/createSheet.js";
import type { Formatting, ToggleKey } from "../lib/formatting.js";
import type { Child } from "@continuum-js/dom";
import { IconPrint, IconSearch } from "../icons.js";

export function Toolbar(props: {
  sheet: Sheet;
  fmt: Formatting;
  setZoom: (z: number) => void;
  focusGrid: () => void;
}) {
  const { sheet, fmt } = props;
  const after = (f: () => void) => () => {
    f();
    props.focusGrid();
  };

  const fmtBtn = (key: ToggleKey, label: Child, titleText: string) => (
    <button
      class={fmt.anchorFormat.map((f) => (f[key] ? "tool on" : "tool"))}
      title={titleText}
      onClick={after(() => fmt.toggle(key))}
    >
      {label}
    </button>
  );
  const alignBtn = (al: "left" | "center" | "right", glyph: string) => (
    <button
      class={fmt.anchorFormat.map((f) =>
        (f.al ?? "left") === al ? "tool on" : "tool",
      )}
      title={`Выравнивание: ${al}`}
      onClick={after(() => fmt.apply({ al: al === "left" ? undefined : al }))}
    >
      {glyph}
    </button>
  );

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
        ↩
      </button>
      <button
        class="tool"
        title="Повторить (Ctrl+Shift+Z)"
        disabled={sheet.canRedo.map((v) => !v)}
        onClick={after(() => sheet.dispatch({ type: "redo" }))}
      >
        ↪
      </button>
      <button class="tool" title="Печать" onClick={() => window.print()}>
        <IconPrint />
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

      {fmtBtn("b", <b>Ж</b>, "Полужирный (Ctrl+B)")}
      {fmtBtn("i", <i>К</i>, "Курсив (Ctrl+I)")}
      {fmtBtn("u", <u>Ч</u>, "Подчёркнутый (Ctrl+U)")}
      {fmtBtn("s", <s>З</s>, "Зачёркнутый")}
      <select
        class="zoom"
        title="Размер шрифта"
        onChange={(e) => {
          const n = Number(e.currentTarget.value);
          props.fmt.apply({ fs: n === 13 ? undefined : n });
          props.focusGrid();
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
          onInput={(e) => fmt.apply({ fg: e.currentTarget.value })}
        />
      </label>
      <label class="tool color" title="Цвет заливки">
        <span class="color-glyph fill">▧</span>
        <input
          type="color"
          value="#ffff88"
          onInput={(e) => fmt.apply({ bg: e.currentTarget.value })}
        />
      </label>
      <button
        class="tool"
        title="Очистить форматирование"
        onClick={after(fmt.clear)}
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
  );
}
