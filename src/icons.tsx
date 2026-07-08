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
