// The formula engine — a pure module: tokenize → parse → evaluate.
// Grammar (case-insensitive refs and function names):
//   expr   := term (("+"|"-") term)*
//   term   := unary (("*"|"/") unary)*
//   unary  := "-" unary | atom
//   atom   := number | ref | call | "(" expr ")"
//   call   := NAME "(" arg ("," arg)* ")"
//   arg    := range | expr          — ranges are legal only as arguments
//   range  := ref ":" ref
// Errors are spreadsheet-style codes carried by FormulaError.

export class FormulaError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export type Expr =
  | { t: "num"; v: number }
  | { t: "ref"; id: string }
  | { t: "range"; from: string; to: string }
  | { t: "neg"; e: Expr }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; l: Expr; r: Expr }
  | { t: "call"; name: string; args: Expr[] };

// ── tokenizer ───────────────────────────────────────────────────────────────

type Token =
  | { k: "num"; v: number }
  | { k: "id"; v: string } // cell ref or function name, uppercased
  | { k: "op"; v: string }; // + - * / ( ) , :

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if ("+-*/(),:".includes(ch)) {
      out.push({ k: "op", v: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) throw new FormulaError("#ERR!");
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      const m = /^[a-zA-Z]+[0-9]*/.exec(src.slice(i))!;
      out.push({ k: "id", v: m[0].toUpperCase() });
      i += m[0].length;
      continue;
    }
    throw new FormulaError("#ERR!");
  }
  return out;
}

const isRef = (name: string) => /^[A-Z]+[0-9]+$/.test(name);

// ── parser ──────────────────────────────────────────────────────────────────

export function parseFormula(src: string): Expr {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expectOp = (v: string) => {
    const t = next();
    if (!t || t.k !== "op" || t.v !== v) throw new FormulaError("#ERR!");
  };

  function parseExpr(): Expr {
    let l = parseTerm();
    for (;;) {
      const t = peek();
      if (t?.k === "op" && (t.v === "+" || t.v === "-")) {
        next();
        l = { t: "bin", op: t.v as "+" | "-", l, r: parseTerm() };
      } else return l;
    }
  }

  function parseTerm(): Expr {
    let l = parseUnary();
    for (;;) {
      const t = peek();
      if (t?.k === "op" && (t.v === "*" || t.v === "/")) {
        next();
        l = { t: "bin", op: t.v as "*" | "/", l, r: parseUnary() };
      } else return l;
    }
  }

  function parseUnary(): Expr {
    const t = peek();
    if (t?.k === "op" && t.v === "-") {
      next();
      return { t: "neg", e: parseUnary() };
    }
    return parseAtom();
  }

  function parseAtom(): Expr {
    const t = next();
    if (!t) throw new FormulaError("#ERR!");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "op" && t.v === "(") {
      const e = parseExpr();
      expectOp(")");
      return e;
    }
    if (t.k === "id") {
      if (peek()?.k === "op" && peek().v === "(") {
        next(); // (
        const args: Expr[] = [parseArg()];
        while (peek()?.k === "op" && peek().v === ",") {
          next();
          args.push(parseArg());
        }
        expectOp(")");
        return { t: "call", name: t.v, args };
      }
      if (!isRef(t.v)) throw new FormulaError("#ERR!");
      return { t: "ref", id: t.v };
    }
    throw new FormulaError("#ERR!");
  }

  function parseArg(): Expr {
    // a range is only recognizable here: REF ":" REF
    const t = peek();
    if (
      t?.k === "id" &&
      isRef(t.v) &&
      toks[pos + 1]?.k === "op" &&
      toks[pos + 1].v === ":"
    ) {
      const from = (next() as { v: string }).v;
      next(); // :
      const to = next();
      if (!to || to.k !== "id" || !isRef(to.v)) throw new FormulaError("#ERR!");
      return { t: "range", from, to: to.v };
    }
    return parseExpr();
  }

  const e = parseExpr();
  if (pos !== toks.length) throw new FormulaError("#ERR!");
  return e;
}

// ── coordinates and dependencies ────────────────────────────────────────────

function splitId(id: string): { col: string; row: number } {
  const m = /^([A-Z]+)([0-9]+)$/.exec(id)!;
  return { col: m[1], row: Number(m[2]) };
}

const colToIndex = (col: string) =>
  [...col].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

/** 1 → "A", 26 → "Z", 27 → "AA". */
export { colToIndex };

export const indexToCol = (n: number): string => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) {
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  }
  return s;
};

export function expandRange(from: string, to: string): string[] {
  const a = splitId(from);
  const b = splitId(to);
  const c1 = Math.min(colToIndex(a.col), colToIndex(b.col));
  const c2 = Math.max(colToIndex(a.col), colToIndex(b.col));
  const r1 = Math.min(a.row, b.row);
  const r2 = Math.max(a.row, b.row);
  const out: string[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) out.push(`${indexToCol(c)}${r}`);
  }
  return out;
}

/** Direct cell dependencies of an expression, ranges expanded, deduped. */
export function refsOf(e: Expr): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };
  const walk = (x: Expr): void => {
    switch (x.t) {
      case "ref":
        return add(x.id);
      case "range":
        return void expandRange(x.from, x.to).forEach(add);
      case "neg":
        return walk(x.e);
      case "bin":
        walk(x.l);
        walk(x.r);
        return;
      case "call":
        x.args.forEach(walk);
        return;
      case "num":
        return;
    }
  };
  walk(e);
  return out;
}

// ── evaluator ───────────────────────────────────────────────────────────────

const FNS: Record<string, (xs: number[]) => number> = {
  SUM: (xs) => xs.reduce((a, b) => a + b, 0),
  AVG: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  MIN: (xs) => (xs.length ? Math.min(...xs) : 0),
  MAX: (xs) => (xs.length ? Math.max(...xs) : 0),
  COUNT: (xs) => xs.length,
};

/** Evaluate with `get` resolving a cell's numeric value. Throws FormulaError. */
export function evaluate(e: Expr, get: (id: string) => number): number {
  switch (e.t) {
    case "num":
      return e.v;
    case "ref":
      return get(e.id);
    case "range":
      throw new FormulaError("#ERR!"); // only valid inside a call
    case "neg":
      return -evaluate(e.e, get);
    case "bin": {
      const l = evaluate(e.l, get);
      const r = evaluate(e.r, get);
      if (e.op === "+") return l + r;
      if (e.op === "-") return l - r;
      if (e.op === "*") return l * r;
      if (r === 0) throw new FormulaError("#DIV/0!");
      return l / r;
    }
    case "call": {
      if (e.name === "SUMPRODUCT") {
        // element-wise product of equal-length vectors, then a sum
        const vecs = e.args.map((a) =>
          a.t === "range"
            ? expandRange(a.from, a.to).map(get)
            : [evaluate(a, get)],
        );
        const len = vecs[0]?.length ?? 0;
        if (vecs.some((v) => v.length !== len)) throw new FormulaError("#ERR!");
        let sum = 0;
        for (let i = 0; i < len; i++) sum += vecs.reduce((p, v) => p * v[i], 1);
        return sum;
      }
      const fn = FNS[e.name];
      if (!fn) throw new FormulaError("#NAME?");
      const xs: number[] = [];
      for (const a of e.args) {
        if (a.t === "range") {
          for (const id of expandRange(a.from, a.to)) xs.push(get(id));
        } else {
          xs.push(evaluate(a, get));
        }
      }
      return fn(xs);
    }
  }
}
