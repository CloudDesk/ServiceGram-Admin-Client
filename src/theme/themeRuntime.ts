import { storageKeys } from '../lib/storage'
import {
  appThemes,
  themeModes,
  type AppTheme,
  type ResolvedThemeMode,
  type ThemeMode,
} from './themes'

export type ThemeCssVariables = Record<`--${string}`, string>

const themeModeSet = new Set<ThemeMode>(themeModes)

function brandGradient(stops: AppTheme['gradients']['brand']) {
  return `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 38%, ${stops[2]} 72%, ${stops[3]} 100%)`
}

function navigationGradient(stops: AppTheme['gradients']['navigation']) {
  return `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 100%)`
}

function softGradient(stops: AppTheme['gradients']['soft']) {
  return `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 100%)`
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && themeModeSet.has(value as ThemeMode)
}

export function getSystemThemeMode(): ResolvedThemeMode {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemMode = getSystemThemeMode(),
): ResolvedThemeMode {
  return mode === 'system' ? systemMode : mode
}

export function getThemeByResolvedMode(mode: ResolvedThemeMode) {
  return appThemes[mode]
}

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'

  const storedMode = window.localStorage.getItem(storageKeys.themeMode)
  return isThemeMode(storedMode) ? storedMode : 'system'
}

export function writeStoredThemeMode(mode: ThemeMode) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(storageKeys.themeMode, mode)
}

export function getThemeCssVariables(theme: AppTheme): ThemeCssVariables {
  return {
    '--sg-color-primary': theme.colors.primary,
    '--sg-color-primary-dark': theme.colors.primaryDark,
    '--sg-color-primary-light': theme.colors.primaryLight,
    '--sg-color-primary-hover': theme.semantic.primaryHover,
    '--sg-color-primary-soft': theme.semantic.primarySoft,
    '--sg-color-secondary-brand': theme.colors.secondary,
    '--sg-color-accent': theme.colors.accent,
    '--sg-color-navigation': theme.colors.navigation,
    '--sg-color-navigation-dark': theme.colors.navigationDark,
    '--sg-color-background': theme.colors.background,
    '--sg-color-surface': theme.colors.surface,
    '--sg-color-surface-soft': theme.colors.surfaceSoft,
    '--sg-color-text-primary': theme.colors.textPrimary,
    '--sg-color-text-secondary': theme.colors.textSecondary,
    '--sg-color-text-on-dark': theme.colors.textOnDark,
    '--sg-color-border': theme.colors.border,
    '--sg-color-divider': theme.colors.divider,
    '--sg-color-success': theme.colors.success,
    '--sg-color-warning': theme.colors.warning,
    '--sg-color-error': theme.colors.error,
    '--sg-color-info': theme.colors.info,
    '--sg-color-secondary-ui': theme.semantic.secondaryUi,
    '--sg-color-secondary-ui-hover': theme.semantic.secondaryUiHover,
    '--sg-color-secondary-ui-foreground': theme.semantic.secondaryUiForeground,
    '--sg-color-selection': theme.semantic.selection,
    '--sg-color-ring': theme.semantic.ring,
    '--sg-color-overlay': theme.semantic.overlay,
    '--sg-color-search-bg': theme.semantic.search,
    '--sg-color-row-hover': theme.semantic.rowHover,
    '--sg-color-table-head': theme.semantic.tableHead,
    '--sg-color-success-soft': theme.semantic.successSoft,
    '--sg-color-warning-soft': theme.semantic.warningSoft,
    '--sg-color-error-soft': theme.semantic.errorSoft,
    '--sg-color-info-soft': theme.semantic.infoSoft,
    '--sg-sidebar-text-main': theme.sidebar.textPrimary,
    '--sg-sidebar-text-muted': theme.sidebar.textSecondary,
    '--sg-sidebar-border': theme.sidebar.border,
    '--sg-sidebar-badge-bg': theme.sidebar.badgeBackground,
    '--sg-sidebar-badge-border': theme.sidebar.badgeBorder,
    '--sg-sidebar-link-hover-bg': theme.sidebar.linkHoverBackground,
    '--sg-sidebar-link-active-bg': theme.sidebar.linkActiveBackground,
    '--sg-sidebar-link-active-border': theme.sidebar.linkActiveBorder,
    '--sg-sidebar-icon-bg': theme.sidebar.iconBackground,
    '--sg-sidebar-icon-border': theme.sidebar.iconBorder,
    '--sg-sidebar-icon-active-bg': theme.sidebar.iconActiveBackground,
    '--sg-sidebar-icon-active-border': theme.sidebar.iconActiveBorder,
    '--sg-gradient-brand': brandGradient(theme.gradients.brand),
    '--sg-gradient-navigation': navigationGradient(theme.gradients.navigation),
    '--sg-gradient-soft': softGradient(theme.gradients.soft),
    '--sg-gradient-glass': theme.surfaces.glassBackground,
    '--sg-gradient-glass-vertical': theme.surfaces.glassBackgroundVertical,
    '--sg-border-glass-highlight': theme.surfaces.glassHighlight,
    '--sg-gradient-page-surface': theme.surfaces.pageBackground,
    '--sg-gradient-appbar': theme.surfaces.appbarBackground,
    '--sg-gradient-skeleton': theme.surfaces.skeleton,
    '--sg-gradient-auth-shell': theme.surfaces.authBackground,
    '--sg-gradient-auth-noise': theme.surfaces.authNoise,
    '--sg-color-auth-glow-primary': theme.surfaces.authGlowPrimary,
    '--sg-color-auth-glow-secondary': theme.surfaces.authGlowSecondary,
    '--sg-color-auth-title': theme.surfaces.authTitle,
    '--sg-color-auth-title-accent': theme.surfaces.authTitleAccent,
    '--sg-color-auth-panel-bg': theme.surfaces.authPanelBackground,
    '--sg-color-auth-panel-border': theme.surfaces.authPanelBorder,
    '--sg-gradient-auth-shine': theme.surfaces.authShine,
    '--sg-shadow-inset-highlight': theme.surfaces.insetHighlight,
    '--sg-shadow-surface': theme.shadows.surface,
    '--sg-shadow-overlay': theme.shadows.overlay,
    '--sg-shadow-premium-sm': theme.shadows.premiumSm,
    '--sg-shadow-premium-md': theme.shadows.premiumMd,
    '--sg-shadow-premium-lg': theme.shadows.premiumLg,
    '--sg-shadow-sidebar': theme.shadows.sidebar,
    '--sg-shadow-appbar': theme.shadows.appbar,
    '--sg-shadow-content-card': theme.shadows.contentCard,
    '--sg-shadow-table-card': theme.shadows.tableCard,
    '--sg-shadow-search': theme.shadows.search,
    '--sg-shadow-auth-glow': theme.shadows.authGlow,
    '--sg-shadow-auth-visual': theme.shadows.authVisual,
    '--sg-shadow-auth-panel': theme.shadows.authPanel,
    '--sg-shadow-floating-popover': theme.shadows.floatingPopover,
    '--sg-shadow-focus': theme.shadows.focus,
    '--sg-shadow-sticky-action': theme.shadows.stickyAction,
  }
}

export function applyThemeToElement(
  theme: AppTheme,
  mode: ThemeMode,
  element = document.documentElement,
) {
  const variables = getThemeCssVariables(theme)

  Object.entries(variables).forEach(([name, value]) => {
    element.style.setProperty(name, value)
  })

  element.dataset.theme = theme.id
  element.dataset.themeMode = mode
  element.style.colorScheme = theme.mode
}

export function initializeTheme() {
  if (typeof document === 'undefined') return

  const mode = readStoredThemeMode()
  const theme = getThemeByResolvedMode(resolveThemeMode(mode))
  applyThemeToElement(theme, mode)
}
