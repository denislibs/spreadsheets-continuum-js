// Row 3: the cell name, fx, and the always-editable formula input.

import type { Events } from "@continuum-js/dom";
import type { Selection } from "../composables/createSelection.js";
import type { Editor } from "../composables/createEditor.js";

export function FormulaBar(props: {
  selection: Selection;
  editor: Editor;
  onKeydown: (e: Events.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const { editor } = props;
  return (
    <div class="formula-bar">
      <span class="cell-name">{props.selection.selectedId}</span>
      <span class="fx">fx</span>
      <input
        class="formula-input"
        placeholder="Введите значение или =формулу"
        value={editor.barValue}
        onInput={(e) => {
          if (!editor.editing.sample()) editor.start(e.currentTarget.value);
          else editor.setDraft(e.currentTarget.value);
        }}
        onKeydown={props.onKeydown}
      />
    </div>
  );
}
