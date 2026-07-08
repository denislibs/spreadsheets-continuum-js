// The bottom bar: fill counter and live aggregates over the selection.

import { Behavior } from "@continuum-js/frp";
import { format, idsInRect } from "../model/sheet.js";
import type { Sheet } from "../composables/createSheet.js";
import type { Selection } from "../composables/createSelection.js";

export function StatusBar(props: { sheet: Sheet; selection: Selection }) {
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
    props.selection.rect,
    props.sheet.computed,
  );

  return (
    <footer class="status">
      <span>Заполнено ячеек: {props.sheet.filled}</span>
      <span class="spacer"></span>
      <span class="agg">{aggregates}</span>
      <span>localStorage · вторая вкладка синхронизируется</span>
    </footer>
  );
}
