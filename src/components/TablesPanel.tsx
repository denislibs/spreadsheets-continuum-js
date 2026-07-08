// The right-hand «Таблицы» panel: pick a template, it lands at the cursor.

import { Show } from "@continuum-js/dom";
import type { Tables } from "../composables/createTables.js";
import type { Template } from "../model/tables.js";
import {
  IconTable,
  IconTasksList,
  IconChartLine,
  IconPersonSm,
  IconClose,
} from "../icons.js";

const ICONS: Record<Template["icon"], () => Node> = {
  grid: IconTable,
  tasks: IconTasksList,
  chart: IconChartLine,
  person: IconPersonSm,
};

export function TablesPanel(props: { tables: Tables }) {
  const { tables } = props;
  return (
    <Show when={tables.panelOpen}>
      {() => (
        <aside class="tables-panel">
          <div class="tp-head">
            <IconTable />
            <span class="tp-title">Таблицы</span>
            <button class="tool" title="Закрыть" onClick={tables.closePanel}>
              <IconClose />
            </button>
          </div>
          <p class="tp-desc">
            Начните с предварительно созданных таблиц: типизированные колонки,
            статусы-чипы и цветовые палитры. Таблица вставится в текущую ячейку.
          </p>
          <div class="tp-list">
            {tables.templates.map((tpl) => (
              <button class="tp-item" onClick={() => tables.insert(tpl)}>
                {ICONS[tpl.icon]()}
                <span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </aside>
      )}
    </Show>
  );
}
