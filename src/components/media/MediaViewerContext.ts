import { createContext, useContext } from 'react'
import type { MediaViewerContextValue } from './MediaViewer.types'

export const MediaViewerContext =
  createContext<MediaViewerContextValue | null>(null)

export function useMediaViewer() {
  const context = useContext(MediaViewerContext)

  if (!context) {
    throw new Error('useMediaViewer must be used inside MediaViewerProvider')
  }

  return context
}
