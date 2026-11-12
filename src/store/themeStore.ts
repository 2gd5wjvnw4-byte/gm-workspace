import { create } from 'zustand';

export type ThemeId = 'scifi' | 'fantasy' | 'fantasyDark';

export interface ThemeTokens {
  label: string;
  bg: string;
  panel: string;
  p2: string;
  p3: string;
  line: string;
  line2: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentBg: string;
  onAccent: string;
  gold: string;
  goldBg: string;
  goldLine: string;
  deltaBg: string;
  deltaText: string;
  red: string;
  redBg: string;
  redLine: string;
  escBg: string;
  teal: string;
  tealBg: string;
  tealLine: string;
  blue: string;
  violet: string;
  violetBg: string;
  violetLine: string;
  readText: string;
  mapBg: string;
  grid: string;
  edge: string;
  stripe: string;
  tagBg: string;
  tagText: string;
  body: string;
  head: string;
  mono: string;
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  scifi: {
    label: 'Sci-Fi Dark',
    bg: '#0D1117',
    panel: '#151B23',
    p2: '#1C232D',
    p3: '#262F3B',
    line: '#2A3340',
    line2: '#3A4553',
    text: '#E6EDF3',
    muted: '#9AA7B4',
    faint: '#6B7785',
    accent: '#56D4E8',
    accentBg: '#10262B',
    onAccent: '#0D1117',
    gold: '#F2B33D',
    goldBg: '#2A2213',
    goldLine: '#6B5320',
    deltaBg: '#3A2A0B',
    deltaText: '#FBE3B0',
    red: '#F47C7C',
    redBg: '#2A1717',
    redLine: '#5A2E2E',
    escBg: '#1F1416',
    teal: '#45C9A9',
    tealBg: '#12251F',
    tealLine: '#2D5A50',
    blue: '#79B8FF',
    violet: '#C8B2FF',
    violetBg: '#2A2240',
    violetLine: '#4B3F6B',
    readText: '#D5DEE7',
    mapBg: '#10161D',
    grid: '#1A222C',
    edge: '#3E5566',
    stripe: '#19202A',
    tagBg: '#E6EDF3',
    tagText: '#0D1117',
    body: "'IBM Plex Sans', system-ui, sans-serif",
    head: "'IBM Plex Sans', system-ui, sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
  },
  fantasy: {
    label: 'Fantasy Light',
    bg: '#EFE6D4',
    panel: '#FAF5EA',
    p2: '#F2E9D8',
    p3: '#E6D9C0',
    line: '#D8C8A8',
    line2: '#BFA982',
    text: '#2B2118',
    muted: '#6A5843',
    faint: '#9A8A72',
    accent: '#9A4416',
    accentBg: '#F5E0D0',
    onAccent: '#FFFFFF',
    gold: '#835C00',
    goldBg: '#F7EACB',
    goldLine: '#C9A55A',
    deltaBg: '#F6E2B5',
    deltaText: '#4A3510',
    red: '#A12F2F',
    redBg: '#F6DEDA',
    redLine: '#D9A39B',
    escBg: '#F8E6E2',
    teal: '#2C6A4D',
    tealBg: '#DFEDE2',
    tealLine: '#9CC4AA',
    blue: '#2A5B8A',
    violet: '#69498F',
    violetBg: '#ECE3F4',
    violetLine: '#BFA9D6',
    readText: '#3B2F22',
    mapBg: '#F3EAD6',
    grid: '#E4D6BA',
    edge: '#A88F68',
    stripe: '#F0E6D2',
    tagBg: '#3B2F22',
    tagText: '#FAF5EA',
    body: "'Alegreya Sans', system-ui, sans-serif",
    head: "'Cinzel', Georgia, serif",
    mono: "'Alegreya Sans', system-ui, sans-serif",
  },
  fantasyDark: {
    label: 'Fantasy Dark',
    bg: '#15120E',
    panel: '#1E1A15',
    p2: '#27221B',
    p3: '#332C23',
    line: '#3A3228',
    line2: '#4E4436',
    text: '#EFE6D4',
    muted: '#B3A48C',
    faint: '#7D705D',
    accent: '#E39A5B',
    accentBg: '#3A2516',
    onAccent: '#15120E',
    gold: '#E2B754',
    goldBg: '#2E2414',
    goldLine: '#6E5526',
    deltaBg: '#3B2B10',
    deltaText: '#F6E2B5',
    red: '#EB8A7E',
    redBg: '#331B18',
    redLine: '#6A342D',
    escBg: '#2A1915',
    teal: '#7CC79E',
    tealBg: '#17291F',
    tealLine: '#33573F',
    blue: '#8FB8E6',
    violet: '#C9B0E8',
    violetBg: '#2B2238',
    violetLine: '#54456B',
    readText: '#E2D7C2',
    mapBg: '#1A1612',
    grid: '#262019',
    edge: '#6E5E48',
    stripe: '#231E18',
    tagBg: '#EFE6D4',
    tagText: '#15120E',
    body: "'Alegreya Sans', system-ui, sans-serif",
    head: "'Cinzel', Georgia, serif",
    mono: "'Alegreya Sans', system-ui, sans-serif",
  },
};

export const THEME_ORDER: ThemeId[] = ['scifi', 'fantasy', 'fantasyDark'];

export const TOKEN_KEYS: Array<Exclude<keyof ThemeTokens, 'label'>> = [
  'bg',
  'panel',
  'p2',
  'p3',
  'line',
  'line2',
  'text',
  'muted',
  'faint',
  'accent',
  'accentBg',
  'onAccent',
  'gold',
  'goldBg',
  'goldLine',
  'deltaBg',
  'deltaText',
  'red',
  'redBg',
  'redLine',
  'escBg',
  'teal',
  'tealBg',
  'tealLine',
  'blue',
  'violet',
  'violetBg',
  'violetLine',
  'readText',
  'mapBg',
  'grid',
  'edge',
  'stripe',
  'tagBg',
  'tagText',
  'body',
  'head',
  'mono',
];

export function defaultThemeForGenre(genre?: string | null): ThemeId {
  if (genre && genre.toLowerCase().includes('fantasy')) {
    return 'fantasy';
  }
  return 'scifi';
}

export function getThemeCssVariables(themeId: ThemeId): Record<string, string> {
  const tokens = THEMES[themeId];
  const vars: Record<string, string> = {};
  for (const key of TOKEN_KEYS) {
    vars[`--${key}`] = tokens[key];
  }
  return vars;
}

export function applyThemeToElement(themeId: ThemeId, el?: HTMLElement | null): void {
  const target = el ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return;
  const tokens = THEMES[themeId];
  target.dataset.theme = themeId;
  for (const key of TOKEN_KEYS) {
    target.style.setProperty(`--${key}`, tokens[key]);
  }
  if (typeof document !== 'undefined') {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', tokens.panel);
    }
  }
}

export interface ThemeStoreState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: 'scifi',
  setTheme: (theme: ThemeId) => {
    applyThemeToElement(theme);
    set({ theme });
  },
}));
