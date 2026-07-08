// A hand-drawn stroke icon set (24px grid, currentColor) — consistent line
// weight instead of mismatched emoji glyphs.

const svg = (children: Node[], viewBox = "0 0 24 24") => (
  <svg
    class="ico"
    viewBox={viewBox}
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {children}
  </svg>
);

export const IconStar = () =>
  svg([
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />,
  ]);

export const IconCloud = () =>
  svg([
    <path d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 8.5 4.5 4.5 0 0 0 7 18z" />,
    <path d="M9.5 13.5l2 2 3.5-3.5" />,
  ]);

export const IconClock = () =>
  svg([<circle cx="12" cy="12" r="8.5" />, <path d="M12 7.5V12l3 2" />]);

export const IconComment = () =>
  svg([
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2z" />,
  ]);

export const IconCam = () =>
  svg([
    <rect x="3" y="7" width="12" height="10" rx="2" />,
    <path d="M15 11l6-3.5v9L15 13" />,
  ]);

export const IconPrint = () =>
  svg([
    <path d="M7 8V4h10v4" />,
    <rect x="4" y="8" width="16" height="8" rx="1.5" />,
    <rect x="7" y="14" width="10" height="6" />,
  ]);

export const IconSearch = () =>
  svg([<circle cx="10.5" cy="10.5" r="6" />, <path d="M15 15l5.5 5.5" />]);

export const IconLock = () =>
  svg([
    <rect x="5.5" y="10.5" width="13" height="9" rx="2" />,
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />,
  ]);

export const IconPen = () =>
  svg([
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />,
    <path d="M14.5 6.5l3 3" />,
  ]);

export const IconChevron = () => svg([<path d="M8 10l4 4 4-4" />]);

export const IconGridLogo = () => (
  <svg class="ico-logo" viewBox="0 0 24 24" width="18" height="18" fill="none">
    <rect
      x="4"
      y="3"
      width="16"
      height="18"
      rx="2"
      stroke="#fff"
      stroke-width="1.8"
    />
    <path d="M8 9h8M8 13h8M8 17h5" stroke="#fff" stroke-width="1.8" />
  </svg>
);

export const IconTable = () =>
  svg([
    <rect x="4" y="5" width="16" height="14" rx="1.5" />,
    <path d="M4 10h16M10 10v9" />,
  ]);

export const IconTasksList = () =>
  svg([
    <path d="M4 6l1.5 1.5L8 5" />,
    <path d="M11 6.5h9" />,
    <path d="M4 12.5l1.5 1.5L8 11.5" />,
    <path d="M11 13h9" />,
    <path d="M11 19h9" />,
  ]);

export const IconChartLine = () =>
  svg([<path d="M4 17l4.5-5 3.5 3 6-7" />, <path d="M4 20h16" />]);

export const IconPersonSm = () =>
  svg([<circle cx="12" cy="8" r="3.5" />, <path d="M5 19.5a7 7 0 0 1 14 0" />]);

export const IconClose = () => svg([<path d="M6 6l12 12M18 6L6 18" />]);

// ── toolbar icon set ─────────────────────────────────────────────────────

export const IconUndo = () =>
  svg([<path d="M8 6L4 10l4 4" />, <path d="M4 10h10a6 6 0 0 1 0 12h-3" />]);

export const IconRedo = () =>
  svg([<path d="M16 6l4 4-4 4" />, <path d="M20 10H10a6 6 0 0 0 0 12h3" />]);

export const IconPaint = () =>
  svg([
    <rect x="5" y="4" width="12" height="5" rx="1" />,
    <path d="M17 6.5h2.5v5H12v3" />,
    <rect x="10.5" y="14.5" width="3" height="5.5" rx="1" />,
  ]);

export const IconPercent = () =>
  svg([
    <circle cx="7.5" cy="7.5" r="2.5" />,
    <circle cx="16.5" cy="16.5" r="2.5" />,
    <path d="M18 5L6 19" />,
  ]);

export const IconDecDec = () =>
  svg([
    <circle cx="5" cy="17" r="1" fill="currentColor" />,
    <path d="M9 13v4M9 15a2.5 2.5 0 0 0 5 0v-2" />,
    <path d="M20 6l-3 3 3 3" transform="translate(0 -1)" />,
  ]);

export const IconDecInc = () =>
  svg([
    <circle cx="4" cy="17" r="1" fill="currentColor" />,
    <path d="M8 13v4M8 15a2 2 0 0 0 4 0v-2M14.5 13v4m0-2a2 2 0 0 0 4 0v-2" />,
    <path d="M17 5l3 3-3 3" transform="translate(0 -2)" />,
  ]);

export const IconMinus = () => svg([<path d="M6 12h12" />]);
export const IconPlus = () => svg([<path d="M12 6v12M6 12h12" />]);

export const IconBorders = () =>
  svg([
    <rect x="4.5" y="4.5" width="15" height="15" />,
    <path d="M4.5 12h15M12 4.5v15" />,
  ]);

export const IconMerge = () =>
  svg([<path d="M9 8L12 5l3 3M9 16l3 3 3-3" />, <path d="M5 12h5m4 0h5" />]);

export const IconAlignLines = (w2: number, w3: number) =>
  svg([<path d={`M4 7h16M4 12h${w2}M4 17h${w3}`} />]);

export const IconValign = () =>
  svg([
    <path d="M12 4v9" />,
    <path d="M8.5 9.5L12 13l3.5-3.5" />,
    <path d="M5 19h14" />,
  ]);

export const IconWrap = () =>
  svg([
    <path d="M4 6h16" />,
    <path d="M4 12h12a3 3 0 0 1 0 6h-3" />,
    <path d="M15.5 15.5L13 18l2.5 2.5" />,
    <path d="M4 18h5" />,
  ]);

export const IconDots = () =>
  svg([
    <circle cx="12" cy="5.5" r="1.2" fill="currentColor" />,
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />,
    <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />,
  ]);

export const IconSigma = () => svg([<path d="M18 7V5H6l6 7-6 7h12v-2" />]);

export const IconLink = () =>
  svg([
    <path d="M10 14a4 4 0 0 1 0-5.6l2.4-2.4a4 4 0 0 1 5.6 5.6L16.6 13" />,
    <path d="M14 10a4 4 0 0 1 0 5.6l-2.4 2.4a4 4 0 0 1-5.6-5.6L7.4 11" />,
  ]);

export const IconFilter = () =>
  svg([<path d="M4 6h16l-6.2 7v5.5L10.2 20v-7z" />]);

// ── border-option minis (solid = applied edges, dotted = the rest) ───────

const DOT = "2 2.5";
const bsvg = (solid: string[], dotted: string[]) => (
  <svg
    class="ico"
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
  >
    {solid.map((d) => (
      <path d={d} />
    ))}
    {dotted.map((d) => (
      <path d={d} stroke-dasharray={DOT} opacity="0.55" />
    ))}
  </svg>
);

const R = "M5 5h14v14H5z";
const H = "M5 12h14";
const V = "M12 5v14";
const TOP = "M5 5h14";
const BOT = "M5 19h14";
const LEFT = "M5 5v14";
const RIGHT = "M19 5v14";

export const IconBAll = () => bsvg([R, H, V], []);
export const IconBInner = () => bsvg([H, V], [R]);
export const IconBHoriz = () => bsvg([H], [R, V]);
export const IconBVert = () => bsvg([V], [R, H]);
export const IconBOuter = () => bsvg([R], [H, V]);
export const IconBLeft = () => bsvg([LEFT], [TOP, BOT, RIGHT, H, V]);
export const IconBTop = () => bsvg([TOP], [LEFT, BOT, RIGHT, H, V]);
export const IconBRight = () => bsvg([RIGHT], [TOP, BOT, LEFT, H, V]);
export const IconBBottom = () => bsvg([BOT], [TOP, LEFT, RIGHT, H, V]);
export const IconBNone = () => bsvg([], [R, H, V]);
