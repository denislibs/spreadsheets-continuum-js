// The document registry: a list of spreadsheets in localStorage. Each doc's
// data lives under its own key (docKey(id) + :title/:widths/:heights); the
// registry stores metadata for the home page.

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number; // ms epoch
}

const REG_KEY = "continuum-tables:registry";
const LEGACY_KEY = "continuum-tables";

export const docKey = (id: string) => `continuum-tables:doc:${id}`;

const read = (): DocMeta[] => {
  try {
    const raw = localStorage.getItem(REG_KEY);
    return raw ? (JSON.parse(raw) as DocMeta[]) : [];
  } catch {
    return [];
  }
};

const write = (docs: DocMeta[]) =>
  localStorage.setItem(REG_KEY, JSON.stringify(docs));

/** One-time: adopt the pre-router single sheet as the first document. */
function migrateLegacy(): void {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy || read().length > 0) return;
  const id = crypto.randomUUID();
  localStorage.setItem(docKey(id), legacy);
  for (const suffix of ["title", "widths", "heights"]) {
    const v = localStorage.getItem(`${LEGACY_KEY}:${suffix}`);
    if (v !== null) localStorage.setItem(`${docKey(id)}:${suffix}`, v);
  }
  const title = localStorage.getItem(`${LEGACY_KEY}:title`);
  write([
    {
      id,
      title: title ? (JSON.parse(title) as string) : "Новая таблица",
      updatedAt: Date.now(),
    },
  ]);
  localStorage.removeItem(LEGACY_KEY);
}

export function loadDocs(): DocMeta[] {
  migrateLegacy();
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createDoc(title = "Новая таблица"): DocMeta {
  const doc: DocMeta = {
    id: crypto.randomUUID(),
    title,
    updatedAt: Date.now(),
  };
  write([...read(), doc]);
  return doc;
}

export function touchDoc(id: string): void {
  write(read().map((d) => (d.id === id ? { ...d, updatedAt: Date.now() } : d)));
}

export function renameDoc(id: string, title: string): void {
  write(read().map((d) => (d.id === id ? { ...d, title } : d)));
}

export function deleteDoc(id: string): void {
  write(read().filter((d) => d.id !== id));
  localStorage.removeItem(docKey(id));
  for (const suffix of ["title", "widths", "heights"]) {
    localStorage.removeItem(`${docKey(id)}:${suffix}`);
  }
}

export const formatDate = (ms: number): string => {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};
