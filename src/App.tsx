// Route layout: the home page (document registry) and the editor. The URL is
// a Behavior — @continuum-js/router keys the editor region by the route
// definition, and useParams delivers :id as a behavior, so /d/1 → /d/2
// swaps the document without tearing the page down twice.

import { Dynamic } from "@continuum-js/dom";
import { Router, useParams, Link } from "@continuum-js/router";
import { Home } from "./components/Home.js";
import { SheetEditor } from "./components/SheetEditor.js";

function DocPage() {
  const id = useParams().map((p) => p.id);
  // a different document is a different editor: key the region by id
  return <Dynamic value={id}>{(d) => <SheetEditor docId={d} />}</Dynamic>;
}

export function App() {
  return (
    <Router
      routes={[
        { path: "", component: Home },
        { path: "d/:id", component: DocPage },
      ]}
      fallback={() => (
        <div class="notfound">
          <h1>Здесь ничего нет</h1>
          <Link href="/">К списку таблиц</Link>
        </div>
      )}
    />
  );
}
