import { createContext, useContext } from 'react'
import type { AppTheme, ResolvedThemeMode, ThemeMode } from '../theme'

export interface ThemeContextValue {
  mode: ThemeMode
  resolvedMode: ResolvedThemeMode
  systemMode: ResolvedThemeMode
  theme: AppTheme
  setMode: (mode: ThemeMode) => void
  toggleResolvedMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}

