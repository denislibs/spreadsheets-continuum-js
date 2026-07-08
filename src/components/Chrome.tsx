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
      /** right-aligned gray sample/shortcut, like Sheets */
      hint?: string;
      disabled?: boolean | Behavior<boolean>;
      /** a nested flyout (opens on hover) instead of an action */
      sub?: MenuItem[];
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
  const [openSub, setOpenSub] = newBehavior<string | null>(null);
  onMount(() => {
    const close = () => setOpenMenu(null);
    window.addEventListener("mousedown", close);
    onCleanup(() => window.removeEventListener("mousedown", close));
  });

  const runItem = (action?: () => void) => {
    action?.();
    setOpenMenu(null);
    setOpenSub(null);
    props.onMenuAction();
  };

  const leafItem = (it: Exclude<MenuItem, { sep: true }>, topLevel = false) => (
    <button
      class="dd-item"
      disabled={it.disabled ?? !it.action}
      onClick={() => runItem(it.action)}
      onMouseenter={topLevel ? () => setOpenSub(null) : undefined}
    >
      <span class="dd-label">{it.label}</span>
      {it.hint && <span class="dd-hint">{it.hint}</span>}
    </button>
  );

  const menuBar = props.menus.map((m) => (
    <span
      class={openMenu.map((o) =>
        o === m.name ? "menu-item open" : "menu-item",
      )}
      onMousedown={(e) => {
        e.stopPropagation();
        if (m.items.length === 0) return;
        setOpenSub(null);
        setOpenMenu(openMenu.sample() === m.name ? null : m.name);
      }}
      onMouseenter={() => {
        // Sheets-style: while one menu is open, hovering slides to the next
        if (openMenu.sample() !== null && m.items.length > 0) {
          setOpenSub(null);
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
                ) : it.sub ? (
                  <div
                    class="dd-item dd-parent"
                    onMouseenter={() => setOpenSub(it.label)}
                  >
                    <span class="dd-label">{it.label}</span>
                    <span class="dd-arrow">▸</span>
                    <Show when={openSub.map((o) => o === it.label)}>
                      {() => (
                        <div class="dropdown dd-sub">
                          {it.sub!.map((si) =>
                            "sep" in si ? (
                              <div class="dd-sep"></div>
                            ) : (
                              leafItem(si)
                            ),
                          )}
                        </div>
                      )}
                    </Show>
                  </div>
                ) : (
                  leafItem(it, true)
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
