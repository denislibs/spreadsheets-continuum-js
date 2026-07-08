// The document composable: ONE stream of actions folded into sheet state,
// mirrored into localStorage, and kept in sync across tabs (the `storage`
// event is just one more dispatcher into the same reducer).
// `create*` = owns live subscriptions — call during component build.

import { newStream, type Behavior, type Stream } from "@continuum-js/frp";
import { onCleanup, onMount } from "@continuum-js/dom";
import { persist, loadPersisted } from "@continuum-js/std";
import {
  evalSheet,
  reduce,
  emptySheet,
  toPlain,
  fromPlain,
  type Action,
  type Raw,
  type Formats,
  type CellFormat,
  type Computed,
  type CellId,
} from "../model/sheet.js";

export const LC_KEY = "continuum-tables";

// persisted payload: cells + formats in one key (one storage event → one
// replace action). Older payloads were the bare cells object — migrate.
type Persisted = { c: Record<string, string>; f: Record<string, CellFormat> };
const migrate = (o: Record<string, unknown>): Persisted =>
  "c" in o
    ? (o as unknown as Persisted)
    : { c: o as Record<string, string>, f: {} };

const formatsToPlain = (f: Formats) => Object.fromEntries(f);
const formatsFromPlain = (o: Record<string, CellFormat>): Formats =>
  new Map(Object.entries(o));

export interface Sheet {
  actions: Stream<Action>;
  dispatch: (a: Action) => void;
  cells: Behavior<Raw>;
  formats: Behavior<Formats>;
  computed: Behavior<Map<CellId, Computed>>;
  canUndo: Behavior<boolean>;
  canRedo: Behavior<boolean>;
  filled: Behavior<number>;
}

export function createSheet(): Sheet {
  const [actions, dispatch] = newStream<Action>();
  const initial = migrate(loadPersisted<Record<string, unknown>>(LC_KEY, {}));
  const state = actions.accum(
    emptySheet(fromPlain(initial.c), formatsFromPlain(initial.f)),
    reduce,
  );
  const cells = state.map((s) => s.cells);
  const formats = state.map((s) => s.formats);

  // persistence: a mirror of the folded value (plain objects for JSON)
  onCleanup(
    persist(
      LC_KEY,
      state.map((s): Persisted => ({
        c: toPlain(s.cells),
        f: formatsToPlain(s.formats),
      })),
    ),
  );

  // cross-tab sync
  onMount(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LC_KEY && e.newValue) {
        const p = migrate(JSON.parse(e.newValue));
        dispatch({
          type: "replace",
          cells: fromPlain(p.c),
          formats: formatsFromPlain(p.f),
        });
      }
    };
    window.addEventListener("storage", onStorage);
    onCleanup(() => window.removeEventListener("storage", onStorage));
  });

  return {
    actions,
    dispatch,
    cells,
    formats,
    computed: cells.map(evalSheet),
    canUndo: state.map((s) => s.past.length > 0),
    canRedo: state.map((s) => s.future.length > 0),
    filled: cells.map((m) => m.size),
  };
}
