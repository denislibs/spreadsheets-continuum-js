// Row 1 of the app: logo, the editable (and persisted) document title, the
// menu bar with working dropdowns, and the right-hand icon cluster.

import { newBehavior, type Behavior } from "@continuum-js/frp";
import { Show, onCleanup, onMount } from "@continuum-js/dom";
import { persist, loadPersisted } from "@continuum-js/std";
import {
  IconStar,
  IconCloud,
  IconClock,
  IconComment,
  IconCam,
  IconLock,
  IconChevron,
  IconGridLogo,
} from "../icons.js";

export type MenuItem =
  | { sep: true }
  | {
      label: string;
      action?: () => void;
      disabled?: boolean | Behavior<boolean>;
    };
export interface Menu {
  name: string;
  items: MenuItem[];
}

/** The title is this component's own concern — created and persisted here. */
export function createDocTitle(storageKey: string) {
  const [title, setTitle] = newBehavior(
    loadPersisted(`${storageKey}:title`, "Новая таблица"),
  );
  onCleanup(persist(`${storageKey}:title`, title));
  return { title, setTitle };
}

export function Chrome(props: {
  title: Behavior<string>;
  setTitle: (v: string) => void;
  menus: Menu[];
  onMenuAction: () => void; // e.g. refocus the grid after an item runs
}) {
  const [openMenu, setOpenMenu] = newBehavior<string | null>(null);
  onMount(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("mousedown", close);
    onCleanup(() => window.removeEventListener("mousedown", close));
  });

  const menuBar = props.menus.map((m) => (
    <span
      class={openMenu.map((o) =>
        o === m.name ? "menu-item open" : "menu-item",
      )}
      onMousedown={(e) => {
        e.stopPropagation();
        if (m.items.length === 0) return;
        setOpenMenu(openMenu.sample() === m.name ? null : m.name);
      }}
      onMouseenter={() => {
        // Sheets-style: while one menu is open, hovering slides to the next
        if (openMenu.sample() !== null && m.items.length > 0) {
          setOpenMenu(m.name);
        }
      }}
    >
      {m.name}
      {m.items.length > 0 && (
        <Show when={openMenu.map((o) => o === m.name)}>
          {() => (
            <div class="dropdown" onMousedown={(e) => e.stopPropagation()}>
              {m.items.map((it) =>
                "sep" in it ? (
                  <div class="dd-sep"></div>
                ) : (
                  <button
                    class="dd-item"
                    disabled={it.disabled ?? !it.action}
                    onClick={() => {
                      it.action?.();
                      setOpenMenu(null);
                      props.onMenuAction();
                    }}
                  >
                    {it.label}
                  </button>
                ),
              )}
            </div>
          )}
        </Show>
      )}
    </span>
  ));

  return (
    <header class="chrome">
      <div class="sheets-logo">
        <IconGridLogo />
      </div>
      <div class="chrome-main">
        <div class="title-row">
          <input
            class="doc-title"
            value={props.title}
            onInput={(e) => props.setTitle(e.currentTarget.value)}
          />
          <span class="chrome-ico" title="Помеченные">
            <IconStar />
          </span>
          <span class="chrome-ico" title="Сохранено на Диске">
            <IconCloud />
          </span>
        </div>
        <nav class="menubar">{menuBar}</nav>
      </div>
      <div class="chrome-right">
        <span class="chrome-ico big" title="История версий">
          <IconClock />
        </span>
        <span class="chrome-ico big" title="Комментарии">
          <IconComment />
        </span>
        <span class="chrome-ico big" title="Видеовстреча">
          <IconCam />
          <IconChevron />
        </span>
        <button class="share">
          <IconLock />
          <span>Настройки Доступа</span>
        </button>
        <div class="avatar" title="Denis">
          D
        </div>
      </div>
    </header>
  );
}
