import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { ThemeContext, type ThemeContextValue } from './themeContext'
import {
  applyThemeToElement,
  getSystemThemeMode,
  getThemeByResolvedMode,
  readStoredThemeMode,
  resolveThemeMode,
  writeStoredThemeMode,
  type ResolvedThemeMode,
  type ThemeMode,
} from '../theme'

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredThemeMode())
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(() =>
    getSystemThemeMode(),
  )
  const resolvedMode = resolveThemeMode(mode, systemMode)
  const theme = getThemeByResolvedMode(resolvedMode)

  useLayoutEffect(() => {
    applyThemeToElement(theme, mode)
  }, [mode, theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaQuery) return undefined

    const handleChange = () => setSystemMode(getSystemThemeMode())
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const setMode = useCallback((nextMode: ThemeMode) => {
    writeStoredThemeMode(nextMode)
    setModeState(nextMode)
  }, [])

  const toggleResolvedMode = useCallback(() => {
    setModeState((currentMode) => {
      const nextMode = resolveThemeMode(currentMode, getSystemThemeMode()) === 'dark'
        ? 'light'
        : 'dark'

      writeStoredThemeMode(nextMode)
      return nextMode
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      setMode,
      systemMode,
      theme,
      toggleResolvedMode,
    }),
    [mode, resolvedMode, setMode, systemMode, theme, toggleResolvedMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
