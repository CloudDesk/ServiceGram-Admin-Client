import '../styles/globals.css'
import { initializeTheme } from '../theme'
import { App } from './App'

initializeTheme()

export function AppBootstrap() {
  return <App />
}
