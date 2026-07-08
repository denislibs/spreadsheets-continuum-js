// The home page, Sheets-style: a "create" strip (blank + our table
// templates) and the document list from the localStorage registry.

import { newBehavior } from "@continuum-js/frp";
import { Dynamic } from "@continuum-js/dom";
import { navigate } from "@continuum-js/router";
import {
  loadDocs,
  createDoc,
  deleteDoc,
  docKey,
  formatDate,
} from "../model/docs.js";
import { TEMPLATES, instantiate, type Template } from "../model/tables.js";
import { IconGridLogo, IconSearch, IconDots, IconTable } from "../icons.js";

export function Home() {
  const [docs, setDocs] = newBehavior(loadDocs());
  const [menuFor, setMenuFor] = newBehavior<string | null>(null);

  const open = (id: string) => navigate(`/d/${id}`);

  const create = (tpl?: Template) => {
    const doc = createDoc(tpl ? tpl.name : "Новая таблица");
    if (tpl) {
      // pre-seed the new document with the template's table at A1
      localStorage.setItem(
        docKey(doc.id),
        JSON.stringify({
          c: {},
          f: {},
          t: [instantiate(tpl, { c: 0, r: 0 }, crypto.randomUUID())],
        }),
      );
      localStorage.setItem(`${docKey(doc.id)}:title`, JSON.stringify(tpl.name));
    }
    open(doc.id);
  };

  const remove = (id: string) => {
    deleteDoc(id);
    setMenuFor(null);
    setDocs(loadDocs());
  };

  return (
    <div class="home">
      <header class="home-top">
        <div class="sheets-logo">
          <IconGridLogo />
        </div>
        <span class="home-title">Таблицы</span>
        <span class="home-search">
          <IconSearch />
          <span>Поиск</span>
        </span>
        <div class="avatar" title="Denis">
          D
        </div>
      </header>

      <section class="home-create">
        <div class="home-create-inner">
          <h2>Создать таблицу</h2>
          <div class="tpl-row">
            <button class="tpl-card" onClick={() => create()}>
              <div class="tpl-preview blank">
                <span class="tpl-plus">+</span>
              </div>
              <span class="tpl-name">Пустая таблица</span>
            </button>
            {TEMPLATES.filter((t) => t.name !== "Пустая таблица").map((tpl) => (
              <button class="tpl-card" onClick={() => create(tpl)}>
                <div class="tpl-preview">
                  <div class="tpl-band"></div>
                  <div class="tpl-line"></div>
                  <div class="tpl-line"></div>
                  <div class="tpl-line short"></div>
                </div>
                <span class="tpl-name">{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section class="home-list">
        <h2>Недавние</h2>
        <Dynamic value={docs}>
          {(list) =>
            list.length === 0 ? (
              <p class="home-empty">
                Пока пусто — создайте первую таблицу выше.
              </p>
            ) : (
              <div>
                {list.map((d) => (
                  <div class="doc-row" onClick={() => open(d.id)}>
                    <span class="doc-ico">
                      <IconTable />
                    </span>
                    <span class="doc-name">{d.title}</span>
                    <span class="doc-owner">я</span>
                    <span class="doc-date">{formatDate(d.updatedAt)}</span>
                    <span class="doc-menu">
                      <button
                        class="tool"
                        title="Действия"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor.sample() === d.id ? null : d.id);
                        }}
                      >
                        <IconDots />
                      </button>
                      <Dynamic value={menuFor}>
                        {(m) =>
                          m === d.id && (
                            <div
                              class="dropdown doc-dd"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                class="dd-item"
                                onClick={() => open(d.id)}
                              >
                                Открыть
                              </button>
                              <button
                                class="dd-item"
                                onClick={() => remove(d.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          )
                        }
                      </Dynamic>
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </Dynamic>
      </section>
    </div>
  );
}
