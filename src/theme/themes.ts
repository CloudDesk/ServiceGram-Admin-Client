export const themeModes = ['light', 'dark', 'system'] as const

export type ThemeMode = (typeof themeModes)[number]
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>

type BrandGradient = readonly [string, string, string, string]
type TwoStopGradient = readonly [string, string]
type ChartPalette = readonly [string, string, string, string, string, string]

export interface ThemeColorTokens {
  primary: string
  primaryDark: string
  primaryLight: string
  secondary: string
  accent: string
  navigation: string
  navigationDark: string
  background: string
  surface: string
  surfaceSoft: string
  textPrimary: string
  textSecondary: string
  textOnDark: string
  border: string
  divider: string
  success: string
  warning: string
  error: string
  info: string
}

interface ThemeGradients {
  brand: BrandGradient
  navigation: TwoStopGradient
  soft: TwoStopGradient
}

interface ThemeSemanticTokens {
  primaryHover: string
  primarySoft: string
  secondaryUi: string
  secondaryUiHover: string
  secondaryUiForeground: string
  selection: string
  ring: string
  overlay: string
  search: string
  rowHover: string
  tableHead: string
  successSoft: string
  warningSoft: string
  errorSoft: string
  infoSoft: string
}

interface ThemeSidebarTokens {
  textPrimary: string
  textSecondary: string
  border: string
  badgeBackground: string
  badgeBorder: string
  linkHoverBackground: string
  linkActiveBackground: string
  linkActiveBorder: string
  iconBackground: string
  iconBorder: string
  iconActiveBackground: string
  iconActiveBorder: string
}

interface ThemeSurfaceTokens {
  glassBackground: string
  glassBackgroundVertical: string
  glassHighlight: string
  pageBackground: string
  appbarBackground: string
  skeleton: string
  authBackground: string
  authNoise: string
  authGlowPrimary: string
  authGlowSecondary: string
  authTitle: string
  authTitleAccent: string
  authPanelBackground: string
  authPanelBorder: string
  authShine: string
  insetHighlight: string
}

interface ThemeShadowTokens {
  surface: string
  overlay: string
  premiumSm: string
  premiumMd: string
  premiumLg: string
  sidebar: string
  appbar: string
  contentCard: string
  tableCard: string
  search: string
  authGlow: string
  authVisual: string
  authPanel: string
  floatingPopover: string
  focus: string
  stickyAction: string
}

export interface ThemeChartTokens {
  palette: ChartPalette
  axisMuted: string
  axisStrong: string
  splitLine: string
  neutral: string
  heatmapRange: readonly [string, string, string]
  border: string
}

export interface AppTheme {
  id: string
  name: string
  mode: ResolvedThemeMode
  colors: ThemeColorTokens
  gradients: ThemeGradients
  semantic: ThemeSemanticTokens
  sidebar: ThemeSidebarTokens
  surfaces: ThemeSurfaceTokens
  shadows: ThemeShadowTokens
  charts: ThemeChartTokens
}

const auroraFlowColors = {
  primary: '#7053D0',
  primaryDark: '#413D7D',
  primaryLight: '#8466D6',
  secondary: '#56B4C6',
  accent: '#68D2C7',
  navigation: '#1D2056',
  navigationDark: '#151D4A',
  background: '#FAF8FE',
  surface: '#FFFFFF',
  surfaceSoft: '#F0F1FA',
  textPrimary: '#1E1D36',
  textSecondary: '#747287',
  textOnDark: '#FFFFFF',
  border: '#E7E5F0',
  divider: '#EFEDF5',
  success: '#37A878',
  warning: '#E9A23B',
  error: '#E05263',
  info: '#4B9CD3',
} satisfies ThemeColorTokens

const auroraFlowDarkColors = {
  primary: '#9B83EE',
  primaryDark: '#7053D0',
  primaryLight: '#B8A7F4',
  secondary: '#64C5D7',
  accent: '#75DFD4',
  navigation: '#10143D',
  navigationDark: '#090D2B',
  background: '#0F1127',
  surface: '#181B3A',
  surfaceSoft: '#23264D',
  textPrimary: '#F8F7FF',
  textSecondary: '#B9B6D0',
  textOnDark: '#FFFFFF',
  border: '#35375F',
  divider: '#2B2E55',
  success: '#63D79F',
  warning: '#F2B75C',
  error: '#F27685',
  info: '#75BDE8',
} satisfies ThemeColorTokens

export const auroraFlowTheme = {
  colors: auroraFlowColors,
  gradients: {
    brand: ['#413D7D', '#7053D0', '#56B4C6', '#68D2C7'],
    navigation: ['#1D2056', '#151D4A'],
    soft: ['#F0EBFF', '#E4FAF7'],
  },
} as const

export const auroraFlowLightTheme = {
  id: 'aurora-flow-light',
  name: 'Aurora Flow',
  mode: 'light',
  colors: auroraFlowColors,
  gradients: auroraFlowTheme.gradients,
  semantic: {
    primaryHover: auroraFlowColors.primaryDark,
    primarySoft: 'rgb(112 83 208 / 0.12)',
    secondaryUi: 'color-mix(in srgb, var(--sg-color-primary) 8%, var(--sg-color-surface-soft))',
    secondaryUiHover: 'color-mix(in srgb, var(--sg-color-primary) 14%, var(--sg-color-surface-soft))',
    secondaryUiForeground: auroraFlowColors.textPrimary,
    selection: 'rgb(112 83 208 / 0.18)',
    ring: auroraFlowColors.primary,
    overlay: 'rgb(19 20 42 / 0.52)',
    search: 'rgb(112 83 208 / 0.05)',
    rowHover: 'rgb(112 83 208 / 0.055)',
    tableHead: auroraFlowColors.surfaceSoft,
    successSoft: 'rgb(55 168 120 / 0.12)',
    warningSoft: 'rgb(233 162 59 / 0.14)',
    errorSoft: 'rgb(224 82 99 / 0.12)',
    infoSoft: 'rgb(75 156 211 / 0.12)',
  },
  sidebar: {
    textPrimary: '#FFFFFF',
    textSecondary: 'rgb(255 255 255 / 0.8)',
    border: 'rgb(255 255 255 / 0.075)',
    badgeBackground: 'rgb(255 255 255 / 0.065)',
    badgeBorder: 'rgb(255 255 255 / 0.1)',
    linkHoverBackground: 'rgb(255 255 255 / 0.055)',
    linkActiveBackground:
      'linear-gradient(135deg, rgb(112 83 208 / 0.44), rgb(86 180 198 / 0.18))',
    linkActiveBorder: 'rgb(104 210 199 / 0.34)',
    iconBackground: 'rgb(255 255 255 / 0.07)',
    iconBorder: 'rgb(255 255 255 / 0.11)',
    iconActiveBackground: 'rgb(104 210 199 / 0.13)',
    iconActiveBorder: 'rgb(104 210 199 / 0.28)',
  },
  surfaces: {
    glassBackground:
      'linear-gradient(135deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.54))',
    glassBackgroundVertical:
      'linear-gradient(180deg, rgb(255 255 255 / 0.78), rgb(255 255 255 / 0.54))',
    glassHighlight: '1px solid rgb(255 255 255 / 0.66)',
    pageBackground:
      'radial-gradient(circle at top left, rgb(255 255 255 / 0.92), transparent 28%), linear-gradient(180deg, #FAF8FE 0%, #F0F1FA 100%)',
    appbarBackground:
      'linear-gradient(180deg, rgb(255 255 255 / 0.88), rgb(255 255 255 / 0.66))',
    skeleton:
      'linear-gradient(90deg, rgb(231 229 240 / 0.74) 0%, rgb(250 248 254 / 0.96) 48%, rgb(231 229 240 / 0.74) 100%)',
    authBackground:
      'radial-gradient(circle at 20% 15%, rgb(255 255 255 / 0.96), transparent 34%), radial-gradient(circle at 85% 10%, rgb(104 210 199 / 0.2), transparent 30%), linear-gradient(135deg, #F0EBFF 0%, #FAF8FE 45%, #E4FAF7 100%)',
    authNoise:
      'linear-gradient(rgb(29 32 86 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(29 32 86 / 0.035) 1px, transparent 1px)',
    authGlowPrimary: 'rgb(255 255 255 / 0.56)',
    authGlowSecondary: 'rgb(112 83 208 / 0.1)',
    authTitle: auroraFlowColors.textPrimary,
    authTitleAccent: auroraFlowColors.primaryDark,
    authPanelBackground: 'rgb(255 255 255 / 0.68)',
    authPanelBorder: 'rgb(255 255 255 / 0.82)',
    authShine:
      'linear-gradient(120deg, transparent 0%, rgb(255 255 255 / 0.52) 45%, transparent 70%)',
    insetHighlight: 'inset 0 1px 0 rgb(255 255 255 / 0.75)',
  },
  shadows: {
    surface: '0 8px 24px rgb(29 32 86 / 0.06)',
    overlay: '0 20px 40px rgb(29 32 86 / 0.16)',
    premiumSm: '0 1px 2px rgb(29 32 86 / 0.03), 0 4px 12px rgb(29 32 86 / 0.04)',
    premiumMd: '0 8px 24px rgb(29 32 86 / 0.07)',
    premiumLg: '0 20px 40px rgb(29 32 86 / 0.16)',
    sidebar: '10px 0 32px rgb(29 32 86 / 0.14), inset -1px 0 0 rgb(255 255 255 / 0.06)',
    appbar: '0 10px 30px rgb(29 32 86 / 0.06)',
    contentCard:
      '0 18px 45px rgb(29 32 86 / 0.07), inset 0 1px 0 rgb(255 255 255 / 0.75)',
    tableCard:
      '0 22px 55px rgb(29 32 86 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.8)',
    search: 'inset 0 1px 0 rgb(255 255 255 / 0.75), 0 6px 18px rgb(29 32 86 / 0.05)',
    authGlow: '0 40px 120px rgb(65 61 125 / 0.16)',
    authVisual:
      '0 20px 60px rgb(65 61 125 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.72)',
    authPanel:
      '0 42px 110px rgb(29 32 86 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.82)',
    floatingPopover:
      '0 18px 42px rgb(29 32 86 / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.72)',
    focus: '0 0 0 3px rgb(112 83 208 / 0.15)',
    stickyAction: '-10px 0 14px -16px rgb(29 32 86 / 0.36)',
  },
  charts: {
    palette: ['#7053D0', '#37A878', '#E9A23B', '#E05263', '#56B4C6', '#68D2C7'],
    axisMuted: auroraFlowColors.textSecondary,
    axisStrong: auroraFlowColors.textPrimary,
    splitLine: 'rgb(65 61 125 / 0.12)',
    neutral: '#D6D3E6',
    heatmapRange: ['#F0F1FA', '#B7E7EE', '#7053D0'],
    border: auroraFlowColors.textPrimary,
  },
} satisfies AppTheme

export const auroraFlowDarkTheme = {
  id: 'aurora-flow-dark',
  name: 'Aurora Flow Dark',
  mode: 'dark',
  colors: auroraFlowDarkColors,
  gradients: {
    brand: ['#413D7D', '#7053D0', '#56B4C6', '#68D2C7'],
    navigation: ['#10143D', '#090D2B'],
    soft: ['#1C1C45', '#123A42'],
  },
  semantic: {
    primaryHover: auroraFlowDarkColors.primaryLight,
    primarySoft: 'rgb(155 131 238 / 0.18)',
    secondaryUi: 'color-mix(in srgb, var(--sg-color-primary) 12%, var(--sg-color-surface-soft))',
    secondaryUiHover: 'color-mix(in srgb, var(--sg-color-primary) 20%, var(--sg-color-surface-soft))',
    secondaryUiForeground: auroraFlowDarkColors.textPrimary,
    selection: 'rgb(155 131 238 / 0.28)',
    ring: auroraFlowDarkColors.primary,
    overlay: 'rgb(3 5 18 / 0.68)',
    search: 'rgb(255 255 255 / 0.055)',
    rowHover: 'rgb(255 255 255 / 0.04)',
    tableHead: '#202349',
    successSoft: 'rgb(99 215 159 / 0.16)',
    warningSoft: 'rgb(242 183 92 / 0.17)',
    errorSoft: 'rgb(242 118 133 / 0.15)',
    infoSoft: 'rgb(117 189 232 / 0.16)',
  },
  sidebar: {
    textPrimary: '#FFFFFF',
    textSecondary: 'rgb(255 255 255 / 0.8)',
    border: 'rgb(255 255 255 / 0.075)',
    badgeBackground: 'rgb(255 255 255 / 0.065)',
    badgeBorder: 'rgb(255 255 255 / 0.1)',
    linkHoverBackground: 'rgb(255 255 255 / 0.055)',
    linkActiveBackground:
      'linear-gradient(135deg, rgb(155 131 238 / 0.42), rgb(86 180 198 / 0.18))',
    linkActiveBorder: 'rgb(117 223 212 / 0.34)',
    iconBackground: 'rgb(255 255 255 / 0.07)',
    iconBorder: 'rgb(255 255 255 / 0.11)',
    iconActiveBackground: 'rgb(117 223 212 / 0.13)',
    iconActiveBorder: 'rgb(117 223 212 / 0.28)',
  },
  surfaces: {
    glassBackground:
      'linear-gradient(135deg, rgb(24 27 58 / 0.84), rgb(24 27 58 / 0.58))',
    glassBackgroundVertical:
      'linear-gradient(180deg, rgb(24 27 58 / 0.84), rgb(24 27 58 / 0.58))',
    glassHighlight: '1px solid rgb(255 255 255 / 0.08)',
    pageBackground:
      'radial-gradient(circle at top left, rgb(112 83 208 / 0.16), transparent 28%), linear-gradient(180deg, #0F1127 0%, #161936 100%)',
    appbarBackground:
      'linear-gradient(180deg, rgb(24 27 58 / 0.9), rgb(24 27 58 / 0.7))',
    skeleton:
      'linear-gradient(90deg, rgb(53 55 95 / 0.64) 0%, rgb(35 38 77 / 0.96) 48%, rgb(53 55 95 / 0.64) 100%)',
    authBackground:
      'radial-gradient(circle at 20% 15%, rgb(112 83 208 / 0.2), transparent 34%), radial-gradient(circle at 85% 10%, rgb(104 210 199 / 0.16), transparent 30%), linear-gradient(135deg, #0F1127 0%, #181B3A 48%, #123A42 100%)',
    authNoise:
      'linear-gradient(rgb(255 255 255 / 0.03) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.03) 1px, transparent 1px)',
    authGlowPrimary: 'rgb(155 131 238 / 0.14)',
    authGlowSecondary: 'rgb(104 210 199 / 0.12)',
    authTitle: auroraFlowDarkColors.textPrimary,
    authTitleAccent: auroraFlowDarkColors.accent,
    authPanelBackground: 'rgb(24 27 58 / 0.72)',
    authPanelBorder: 'rgb(255 255 255 / 0.12)',
    authShine:
      'linear-gradient(120deg, transparent 0%, rgb(255 255 255 / 0.09) 45%, transparent 70%)',
    insetHighlight: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
  },
  shadows: {
    surface: '0 8px 24px rgb(0 0 0 / 0.24)',
    overlay: '0 24px 60px rgb(0 0 0 / 0.58)',
    premiumSm: '0 4px 12px rgb(0 0 0 / 0.22)',
    premiumMd: '0 12px 32px rgb(0 0 0 / 0.38)',
    premiumLg: '0 24px 60px rgb(0 0 0 / 0.58)',
    sidebar: '10px 0 34px rgb(0 0 0 / 0.28), inset -1px 0 0 rgb(255 255 255 / 0.055)',
    appbar: '0 10px 34px rgb(0 0 0 / 0.28)',
    contentCard:
      '0 18px 45px rgb(0 0 0 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.06)',
    tableCard:
      '0 22px 55px rgb(0 0 0 / 0.32), inset 0 1px 0 rgb(255 255 255 / 0.06)',
    search: 'inset 0 1px 0 rgb(255 255 255 / 0.06), 0 6px 18px rgb(0 0 0 / 0.22)',
    authGlow: '0 40px 120px rgb(0 0 0 / 0.34)',
    authVisual:
      '0 20px 60px rgb(0 0 0 / 0.36), inset 0 1px 0 rgb(255 255 255 / 0.08)',
    authPanel:
      '0 42px 110px rgb(0 0 0 / 0.46), inset 0 1px 0 rgb(255 255 255 / 0.08)',
    floatingPopover:
      '0 18px 42px rgb(0 0 0 / 0.36), inset 0 1px 0 rgb(255 255 255 / 0.08)',
    focus: '0 0 0 3px rgb(155 131 238 / 0.22)',
    stickyAction: '-10px 0 14px -16px rgb(0 0 0 / 0.68)',
  },
  charts: {
    palette: ['#9B83EE', '#63D79F', '#F2B75C', '#F27685', '#64C5D7', '#75DFD4'],
    axisMuted: auroraFlowDarkColors.textSecondary,
    axisStrong: auroraFlowDarkColors.textPrimary,
    splitLine: 'rgb(255 255 255 / 0.1)',
    neutral: '#555978',
    heatmapRange: ['#23264D', '#236A78', '#9B83EE'],
    border: auroraFlowDarkColors.textPrimary,
  },
} satisfies AppTheme

export const appThemes = {
  light: auroraFlowLightTheme,
  dark: auroraFlowDarkTheme,
} satisfies Record<ResolvedThemeMode, AppTheme>
